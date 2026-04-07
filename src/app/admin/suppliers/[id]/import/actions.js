"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseCSVText, autoDetectMapping } from "./csvParser";

// ── Normalisation ─────────────────────────────────────────

function toDisplayName(raw) {
  const s = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// findOrCreate Category (case-insensitive, stores display form)
async function findOrCreateCategory(rawName) {
  const display = toDisplayName(rawName);
  try {
    return await prisma.category.upsert({
      where: { name: display },
      update: {},
      create: { name: display },
    });
  } catch {
    return prisma.category.findFirst({
      where: { name: { equals: display, mode: "insensitive" } },
    });
  }
}

// findOrCreate Unit
async function findOrCreateUnit(rawName) {
  const display = rawName.trim().replace(/\s+/g, " ");
  if (!display) return null;
  try {
    return await prisma.unit.upsert({
      where: { name: display },
      update: {},
      create: { name: display },
    });
  } catch {
    return prisma.unit.findFirst({
      where: { name: { equals: display, mode: "insensitive" } },
    });
  }
}

// ── Action 1: Create Draft Batch ──────────────────────────

export async function createDraftBatch(_prev, fd) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Нет доступа. Нужна роль администратора." };
  }

  const supplierId = fd.get("supplierId");
  if (!supplierId) return { error: "Не указан поставщик." };

  const file = fd.get("file");
  if (!file || file.size === 0) return { error: "Файл не выбран." };
  if (file.size > 5 * 1024 * 1024) return { error: "Файл слишком большой (макс. 5 МБ)." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { error: "Принимаются только файлы .csv." };

  let text;
  try { text = await file.text(); }
  catch { return { error: "Не удалось прочитать файл." }; }

  const { headers, rows, delim } = parseCSVText(text);
  if (!headers.length) return { error: "Файл пуст или неверный формат." };

  const autoMap = autoDetectMapping(headers);
  const getIdx = (field) => {
    const v = fd.get(`map_${field}`);
    if (v !== null && v !== "-1" && v !== "") return parseInt(v, 10);
    return autoMap[field] ?? -1;
  };

  const nameIdx     = getIdx("name");
  const categoryIdx = getIdx("category");
  const unitIdx     = getIdx("unit");
  const priceIdx    = getIdx("price");
  const skuIdx      = getIdx("sku");
  const imageUrlIdx = getIdx("imageUrl");

  if (nameIdx < 0 || categoryIdx < 0 || unitIdx < 0 || priceIdx < 0) {
    return {
      error: "Не удалось определить обязательные колонки: Название, Категория, Ед, Цена.",
    };
  }

  // Build batch row data (validate each row, mark OK or ERROR)
  const rowsData = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawName     = row[nameIdx]?.trim()    ?? "";
    const rawCategory = row[categoryIdx]?.trim() ?? "";
    const rawUnit     = row[unitIdx]?.trim()     ?? "";
    const rawPrice    = row[priceIdx]?.trim()    ?? "";
    const rawSku      = skuIdx >= 0 ? (row[skuIdx]?.trim() || null) : null;
    const rawImageUrl = imageUrlIdx >= 0 ? (row[imageUrlIdx]?.trim() || null) : null;

    let status = "OK";
    let errorMessage = null;

    if (!rawName || rawName.trim().length < 2) {
      status = "ERROR";
      errorMessage = rawName ? "Название слишком короткое (менее 2 символов)" : "Пустое название — строка пропущена";
    } else if (!rawCategory) {
      status = "ERROR";
      errorMessage = "Пустая категория";
    } else if (!rawUnit) {
      status = "ERROR";
      errorMessage = "Пустая единица измерения";
    } else {
      const price = parseInt(rawPrice, 10);
      if (isNaN(price) || price <= 0) {
        status = "ERROR";
        errorMessage = `Цена должна быть > 0 (получено: "${rawPrice}")`;
      }
    }

    rowsData.push({
      rowNumber: i + 2,
      rawName,
      rawCategory,
      rawUnit,
      rawPrice,
      rawSku,
      rawImageUrl,
      status,
      errorMessage,
    });
  }

  const okCount    = rowsData.filter((r) => r.status === "OK").length;
  const errorCount = rowsData.filter((r) => r.status === "ERROR").length;

  // Create batch + rows in one transaction
  const batch = await prisma.priceImportBatch.create({
    data: {
      supplierId,
      fileName:        file.name,
      delimiter:       delim,
      status:          "DRAFT",
      createdByUserId: String(session.sub),
      rows: { create: rowsData },
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorType:  "ADMIN",
      actorLabel: session?.email ?? "system",
      action:     "IMPORT_PRICE_LIST_DRAFT",
      entityType: "PRICE_IMPORT_BATCH",
      entityId:   batch.id,
      meta: { supplierId, fileName: file.name, okCount, errorCount },
    },
  });

  const errors = rowsData
    .filter((r) => r.status === "ERROR")
    .map((r) => `Строка ${r.rowNumber}: ${r.errorMessage}`);

  return { batchId: batch.id, okCount, errorCount, errors, fileName: file.name };
}

// ── Action 2: Apply Draft Batch ───────────────────────────

export async function applyBatch(_prev, fd) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Нет доступа." };
  }

  const batchId = fd.get("batchId");
  if (!batchId) return { error: "Не указан черновик импорта." };

  const batch = await prisma.priceImportBatch.findUnique({
    where: { id: batchId },
    include: { rows: { where: { status: "OK" } } },
  });
  if (!batch) return { error: "Черновик импорта не найден." };
  if (batch.status === "APPLIED") return { error: "Этот импорт уже применён." };

  const supplierId = batch.supplierId;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errorsCount = 0;

  for (const row of batch.rows) {
    // Re-validate at apply time
    const trimName = row.rawName?.trim() ?? "";
    const trimCat  = row.rawCategory?.trim() ?? "";
    const trimUnit = row.rawUnit?.trim() ?? "";
    const price    = parseInt(row.rawPrice, 10);

    let rowError = null;
    if (trimName.length < 2)            rowError = "Название слишком короткое (менее 2 символов)";
    else if (!trimCat)                  rowError = "Пустая категория";
    else if (!trimUnit)                 rowError = "Пустая единица измерения";
    else if (isNaN(price) || price <= 0) rowError = `Цена должна быть > 0 (получено: "${row.rawPrice}")`;

    if (rowError) {
      await prisma.priceImportRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: rowError },
      });
      errorsCount++;
      continue;
    }

    try {
      const category = await findOrCreateCategory(row.rawCategory);
      const unit     = await findOrCreateUnit(row.rawUnit);
      if (!category || !unit) {
        await prisma.priceImportRow.update({
          where: { id: row.id },
          data: {
            status: "ERROR",
            errorMessage: "Не удалось создать категорию или единицу измерения.",
          },
        });
        errorsCount++;
        continue;
      }

      const sku      = row.rawSku      || null;
      const imageUrl = row.rawImageUrl || null;

      // Match by SKU first, then by name+unit
      let existing = null;
      if (sku) {
        existing = await prisma.product.findFirst({ where: { supplierId, sku } });
      }
      if (!existing) {
        existing = await prisma.product.findFirst({
          where: { supplierId, name: row.rawName, unitId: unit.id },
        });
      }

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            price,
            categoryId: category.id,
            unitId:     unit.id,
            isActive:   true,
            ...(imageUrl !== null ? { imageUrl } : {}),
            ...(sku      !== null ? { sku }      : {}),
          },
        });
        updated++;
      } else {
        await prisma.product.create({
          data: {
            supplierId,
            name:       row.rawName,
            categoryId: category.id,
            unitId:     unit.id,
            price,
            sku,
            imageUrl,
            isActive: true,
          },
        });
        created++;
      }
    } catch {
      errorsCount++;
    }
  }

  // Mark batch APPLIED
  await prisma.priceImportBatch.update({
    where: { id: batchId },
    data: { status: "APPLIED" },
  });

  await prisma.auditLog.create({
    data: {
      actorType:  "ADMIN",
      actorLabel: session?.email ?? "system",
      action:     "APPLY_PRICE_LIST",
      entityType: "PRICE_IMPORT_BATCH",
      entityId:   batchId,
      meta: { created, updated, skipped, errorsCount, fileName: batch.fileName },
    },
  });

  revalidatePath("/admin/suppliers");

  return { success: true, created, updated, skipped, errorsCount, fileName: batch.fileName };
}
