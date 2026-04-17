"use server";

import { prisma } from "@/lib/db";
import { assertOperatorOrAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";
import { parseCSVText, autoDetectMapping } from "./csvParser";
import { logger } from "@/lib/logger";

// ── Normalisation ─────────────────────────────────────────

function toDisplayName(raw) {
  const s = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// findOrCreate Category (case-insensitive, stores display form).
// upsert can race against parallel imports (P2002 unique violation);
// fall back to findFirst on the display name.
async function findOrCreateCategory(rawName) {
  const display = toDisplayName(rawName);
  try {
    return await prisma.category.upsert({
      where: { name: display },
      update: {},
      create: { name: display },
    });
  } catch (e) {
    logger.warn({ err: e, display, code: e?.code, op: "import.category" }, "category upsert race, retrying findFirst");
    return prisma.category.findFirst({
      where: { name: { equals: display, mode: "insensitive" } },
    });
  }
}

async function findOrCreateUnit(rawName) {
  const display = rawName.trim().replace(/\s+/g, " ");
  if (!display) return null;
  try {
    return await prisma.unit.upsert({
      where: { name: display },
      update: {},
      create: { name: display },
    });
  } catch (e) {
    logger.warn({ err: e, display, code: e?.code, op: "import.unit" }, "unit upsert race, retrying findFirst");
    return prisma.unit.findFirst({
      where: { name: { equals: display, mode: "insensitive" } },
    });
  }
}

// ── Action 1: Create Draft Batch ──────────────────────────

export async function createDraftBatch(_prev, fd) {
  const session = await assertOperatorOrAdmin();

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
  const session = await assertOperatorOrAdmin();

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
        await prisma.priceImportRow.update({
          where: { id: row.id },
          data: {
            appliedProductId: existing.id,
            previousPrice:    existing.price,
            previousActive:   existing.isActive,
          },
        });
        updated++;
      } else {
        const createdProduct = await prisma.product.create({
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
        await prisma.priceImportRow.update({
          where: { id: row.id },
          data: {
            appliedProductId: createdProduct.id,
            previousPrice:    null,
            previousActive:   null,
          },
        });
        created++;
      }
    } catch (e) {
      logger.error({ err: e, rowId: row.id, op: "import.applyBatch" }, "applyBatch row failed");
      try {
        await prisma.priceImportRow.update({
          where: { id: row.id },
          data: {
            status: "ERROR",
            errorMessage: `DB error: ${e?.code ?? e?.message ?? "unknown"}`,
          },
        });
      } catch (logErr) {
        logger.error({ err: logErr, rowId: row.id, op: "import.applyBatch" }, "failed to mark row as ERROR");
      }
      errorsCount++;
    }
  }

  // Mark batch APPLIED
  await prisma.priceImportBatch.update({
    where: { id: batchId },
    data: { status: "APPLIED", appliedAt: new Date() },
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

// ── Action 3: Undo Applied Batch ──────────────────────────

export async function undoBatch(_prev, fd) {
  const session = await assertOperatorOrAdmin();

  const batchId = fd.get("batchId");
  if (!batchId) return { error: "Не указан импорт." };

  const batch = await prisma.priceImportBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        where: { appliedProductId: { not: null } },
      },
    },
  });
  if (!batch) return { error: "Импорт не найден." };
  if (batch.status !== "APPLIED") {
    return { error: "Откатить можно только применённый импорт." };
  }

  const affectedProductIds = batch.rows
    .map((r) => r.appliedProductId)
    .filter(Boolean);

  if (affectedProductIds.length === 0) {
    await prisma.priceImportBatch.update({
      where: { id: batchId },
      data: { status: "REVERTED", revertedAt: new Date() },
    });
    return { success: true, reverted: 0, fileName: batch.fileName };
  }

  // Conflict check: any newer APPLIED batch touched the same products?
  const pivot = batch.appliedAt ?? batch.createdAt;
  const conflicts = await prisma.priceImportRow.findMany({
    where: {
      appliedProductId: { in: affectedProductIds },
      batch: {
        status: "APPLIED",
        id:     { not: batchId },
        OR: [
          { appliedAt: { gt: pivot } },
          { AND: [{ appliedAt: null }, { createdAt: { gt: pivot } }] },
        ],
      },
    },
    select: {
      appliedProductId: true,
      batch: { select: { id: true, fileName: true } },
    },
  });

  if (conflicts.length > 0) {
    const seen = new Set();
    const details = [];
    for (const c of conflicts) {
      const key = `${c.batch.id}:${c.appliedProductId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      details.push(`${c.batch.fileName} → product ${c.appliedProductId}`);
    }
    return {
      error:
        "Невозможно откатить: более свежий применённый импорт затрагивает те же товары.",
      conflicts: details,
    };
  }

  let restored = 0;
  let deactivated = 0;

  for (const row of batch.rows) {
    try {
      if (row.previousPrice === null || row.previousPrice === undefined) {
        // Product was CREATED by this batch → deactivate (keep to preserve order refs)
        await prisma.product.update({
          where: { id: row.appliedProductId },
          data:  { isActive: false },
        });
        deactivated++;
      } else {
        await prisma.product.update({
          where: { id: row.appliedProductId },
          data: {
            price:    row.previousPrice,
            isActive: row.previousActive ?? true,
          },
        });
        restored++;
      }
    } catch (e) {
      logger.error(
        { err: e, rowId: row.id, productId: row.appliedProductId, op: "import.undoBatch" },
        "undoBatch row failed"
      );
    }
  }

  await prisma.priceImportBatch.update({
    where: { id: batchId },
    data: { status: "REVERTED", revertedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorType:  "ADMIN",
      actorLabel: session?.email ?? "system",
      action:     "REVERT_PRICE_LIST",
      entityType: "PRICE_IMPORT_BATCH",
      entityId:   batchId,
      meta: { restored, deactivated, fileName: batch.fileName },
    },
  });

  revalidatePath("/admin/suppliers");

  return { success: true, restored, deactivated, fileName: batch.fileName };
}
