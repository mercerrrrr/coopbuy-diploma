"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function str(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData, key) {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

function prismaNiceError(e) {
  const code = e?.code;

  if (code === "P2002") return "Уже существует запись с таким значением (уникальность).";
  if (code === "P2003") return "Нельзя удалить: есть связанные записи.";
  return "Ошибка базы данных. Подробности в терминале.";
}

export async function createRegion(formData) {
  const name = str(formData, "name");
  if (!name) throw new Error("Название региона не может быть пустым.");

  try {
    await prisma.region.create({ data: { name } });
    revalidatePath("/admin/locations");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}

export async function deleteRegion(formData) {
  const id = str(formData, "id");
  if (!id) throw new Error("Не передан id региона.");

  try {
    await prisma.region.delete({ where: { id } });
    revalidatePath("/admin/locations");
  } catch (e) {
    console.error(e);
    // Скорее всего Restrict из-за settlements
    throw new Error("Нельзя удалить регион, пока в нём есть населённые пункты.");
  }
}

export async function createSettlement(formData) {
  const regionId = str(formData, "regionId");
  const name = str(formData, "name");
  if (!regionId) throw new Error("Не передан regionId.");
  if (!name) throw new Error("Название населённого пункта не может быть пустым.");

  try {
    await prisma.settlement.create({ data: { regionId, name } });
    revalidatePath("/admin/locations");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}

export async function deleteSettlement(formData) {
  const id = str(formData, "id");
  if (!id) throw new Error("Не передан id населённого пункта.");

  try {
    await prisma.settlement.delete({ where: { id } });
    revalidatePath("/admin/locations");
  } catch (e) {
    console.error(e);
    throw new Error("Нельзя удалить населённый пункт, пока в нём есть пункты выдачи/зоны поставщиков.");
  }
}

export async function createPickupPoint(formData) {
  const settlementId = str(formData, "settlementId");
  const name = str(formData, "name");
  const address = str(formData, "address");
  const hasFreezer = bool(formData, "hasFreezer");

  if (!settlementId) throw new Error("Не передан settlementId.");
  if (!name) throw new Error("Название пункта выдачи не может быть пустым.");
  if (!address) throw new Error("Адрес пункта выдачи не может быть пустым.");

  try {
    await prisma.pickupPoint.create({
      data: { settlementId, name, address, hasFreezer },
    });
    revalidatePath("/admin/locations");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}

export async function deletePickupPoint(formData) {
  const id = str(formData, "id");
  if (!id) throw new Error("Не передан id пункта выдачи.");

  try {
    await prisma.pickupPoint.delete({ where: { id } });
    revalidatePath("/admin/locations");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}
