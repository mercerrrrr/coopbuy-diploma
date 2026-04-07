"use server";

import { prisma } from "@/lib/db";
import { str, bool, prismaNiceError } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/guards";

export async function createRegion(_prev, formData) {
  await assertAdmin();
  const name = str(formData, "name");
  if (!name) return { ok: false, message: "Название региона не может быть пустым." };

  try {
    await prisma.region.create({ data: { name } });
    revalidatePath("/admin/locations");
    return { ok: true, message: "Регион добавлен." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteRegion(_prev, formData) {
  await assertAdmin();
  const id = str(formData, "id");
  if (!id) return { ok: false, message: "Не передан регион." };

  try {
    await prisma.region.delete({ where: { id } });
    revalidatePath("/admin/locations");
    return { ok: true, message: "Регион удалён." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function createSettlement(_prev, formData) {
  await assertAdmin();
  const regionId = str(formData, "regionId");
  const name = str(formData, "name");
  if (!regionId) return { ok: false, message: "Не передан regionId." };
  if (!name) return { ok: false, message: "Название населённого пункта не может быть пустым." };

  try {
    await prisma.settlement.create({ data: { regionId, name } });
    revalidatePath("/admin/locations");
    return { ok: true, message: "Населённый пункт добавлен." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteSettlement(_prev, formData) {
  await assertAdmin();
  const id = str(formData, "id");
  if (!id) return { ok: false, message: "Не передан населённый пункт." };

  try {
    await prisma.settlement.delete({ where: { id } });
    revalidatePath("/admin/locations");
    return { ok: true, message: "Населённый пункт удалён." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function createPickupPoint(_prev, formData) {
  await assertAdmin();
  const settlementId = str(formData, "settlementId");
  const name = str(formData, "name");
  const address = str(formData, "address");
  const hasFreezer = bool(formData, "hasFreezer");

  if (!settlementId) return { ok: false, message: "Не передан settlementId." };
  if (!name) return { ok: false, message: "Название пункта выдачи не может быть пустым." };
  if (!address) return { ok: false, message: "Адрес пункта выдачи не может быть пустым." };

  try {
    await prisma.pickupPoint.create({
      data: { settlementId, name, address, hasFreezer },
    });
    revalidatePath("/admin/locations");
    return { ok: true, message: "Пункт выдачи добавлен." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deletePickupPoint(_prev, formData) {
  await assertAdmin();
  const id = str(formData, "id");
  if (!id) return { ok: false, message: "Не передан пункт выдачи." };

  try {
    await prisma.pickupPoint.delete({ where: { id } });
    revalidatePath("/admin/locations");
    return { ok: true, message: "Пункт выдачи удалён." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}
