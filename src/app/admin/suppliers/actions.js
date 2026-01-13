"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function str(fd, key) {
  return String(fd.get(key) ?? "").trim();
}

function num(fd, key) {
  const raw = str(fd, key).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function prismaNiceError(e) {
  const code = e?.code;
  if (code === "P2002") return "Уже существует запись с таким значением (уникальность).";
  if (code === "P2003") return "Нельзя выполнить: есть связанные записи.";
  return "Ошибка базы данных. Подробности в терминале.";
}

/** Создать поставщика */
export async function createSupplier(_prev, fd) {
  const name = str(fd, "name");
  const minOrderSum = Math.trunc(num(fd, "minOrderSum"));
  const phone = str(fd, "phone") || null;
  const email = str(fd, "email") || null;

  if (!name) return { ok: false, message: "Название поставщика не может быть пустым." };
  if (!Number.isFinite(minOrderSum) || minOrderSum < 0)
    return { ok: false, message: "Минимальная сумма должна быть числом ≥ 0." };

  try {
    await prisma.supplier.create({
      data: { name, minOrderSum, phone, email, isActive: true },
    });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Поставщик добавлен." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

/** Переключить активность поставщика */
export async function toggleSupplierActive(fd) {
  const id = str(fd, "id");
  const current = str(fd, "current");

  if (!id) throw new Error("Не передан id поставщика.");

  const isActive = current !== "true"; // переворачиваем
  await prisma.supplier.update({ where: { id }, data: { isActive } });

  revalidatePath("/admin/suppliers");
}

/** Удалить поставщика */
export async function deleteSupplier(fd) {
  const id = str(fd, "id");
  if (!id) throw new Error("Не передан id поставщика.");

  try {
    await prisma.supplier.delete({ where: { id } });
    revalidatePath("/admin/suppliers");
  } catch (e) {
    console.error(e);
    throw new Error("Нельзя удалить поставщика: есть зоны доставки или товары.");
  }
}

/** Добавить зону доставки (привязка поставщик → населённый пункт) */
export async function addDeliveryZone(_prev, fd) {
  const supplierId = str(fd, "supplierId");
  const settlementId = str(fd, "settlementId");

  if (!supplierId) return { ok: false, message: "Не передан supplierId." };
  if (!settlementId) return { ok: false, message: "Выбери населённый пункт." };

  try {
    await prisma.supplierDeliveryZone.upsert({
      where: { supplierId_settlementId: { supplierId, settlementId } },
      update: { isActive: true },
      create: { supplierId, settlementId, isActive: true },
    });

    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Зона доставки добавлена." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

/** Удалить зону доставки */
export async function deleteDeliveryZone(fd) {
  const id = str(fd, "id");
  if (!id) throw new Error("Не передан id зоны доставки.");

  try {
    await prisma.supplierDeliveryZone.delete({ where: { id } });
    revalidatePath("/admin/suppliers");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}

/** Добавить товар */
export async function createProduct(_prev, fd) {
  const supplierId = str(fd, "supplierId");
  const name = str(fd, "name");
  const category = str(fd, "category");
  const unit = str(fd, "unit");
  const sku = str(fd, "sku") || null;
  const imageUrl = str(fd, "imageUrl") || null;
  const price = Math.trunc(num(fd, "price"));

  if (!supplierId) return { ok: false, message: "Не передан supplierId." };
  if (!name) return { ok: false, message: "Название товара не может быть пустым." };
  if (!category) return { ok: false, message: "Категория не может быть пустой." };
  if (!unit) return { ok: false, message: "Единица измерения не может быть пустой." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, message: "Цена должна быть числом > 0." };

  try {
    await prisma.product.create({
      data: { supplierId, name, category, unit, sku, imageUrl, price, isActive: true },
    });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Товар добавлен." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

/** Удалить товар */
export async function deleteProduct(fd) {
  const id = str(fd, "id");
  if (!id) throw new Error("Не передан id товара.");

  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/suppliers");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}
