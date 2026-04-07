"use server";

import { prisma } from "@/lib/db";
import { str, num, prismaNiceError } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/guards";

export async function createSupplier(_prev, fd) {
  await assertAdmin();
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

export async function toggleSupplierActive(_prev, fd) {
  await assertAdmin();
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "Не передан поставщик." };

  // Читаем актуальное состояние из БД, не доверяем hidden input
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { isActive: true } });
  if (!supplier) return { ok: false, message: "Поставщик не найден." };

  await prisma.supplier.update({ where: { id }, data: { isActive: !supplier.isActive } });
  revalidatePath("/admin/suppliers");
  return {
    ok: true,
    message: supplier.isActive ? "Поставщик отключён." : "Поставщик снова доступен.",
  };
}

export async function deleteSupplier(_prev, fd) {
  await assertAdmin();
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "Не передан поставщик." };

  try {
    await prisma.supplier.delete({ where: { id } });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Поставщик удалён." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function addDeliveryZone(_prev, fd) {
  await assertAdmin();
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

export async function deleteDeliveryZone(_prev, fd) {
  await assertAdmin();
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "Не передана зона доставки." };

  try {
    await prisma.supplierDeliveryZone.delete({ where: { id } });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Зона доставки удалена." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function createProduct(_prev, fd) {
  await assertAdmin();
  const supplierId = str(fd, "supplierId");
  const name = str(fd, "name");
  const categoryId = str(fd, "categoryId");
  const unitId = str(fd, "unitId");
  const sku = str(fd, "sku") || null;
  const imageUrlRaw = str(fd, "imageUrl") || null;
  const price = Math.trunc(num(fd, "price"));

  if (!supplierId) return { ok: false, message: "Не передан supplierId." };
  if (!name) return { ok: false, message: "Название товара не может быть пустым." };
  if (!categoryId) return { ok: false, message: "Выбери категорию." };
  if (!unitId) return { ok: false, message: "Выбери единицу измерения." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, message: "Цена должна быть числом > 0." };

  // Валидация URL изображения
  let imageUrl = null;
  if (imageUrlRaw) {
    try {
      const parsed = new URL(imageUrlRaw);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, message: "imageUrl должен начинаться с https:// или http://" };
      }
      imageUrl = imageUrlRaw;
    } catch {
      return { ok: false, message: "imageUrl имеет некорректный формат URL." };
    }
  }

  try {
    await prisma.product.create({
      data: { supplierId, name, categoryId, unitId, sku, imageUrl, price, isActive: true },
    });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Товар добавлен." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteProduct(_prev, fd) {
  await assertAdmin();
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "Не передан товар." };

  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Товар удалён." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}
