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

function makeCode() {
  // короткий код для ссылки (не крипто, но для диплома норм)
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export async function createProcurement(_prev, fd) {
  const supplierId = str(fd, "supplierId");
  const settlementId = str(fd, "settlementId");
  const pickupPointId = str(fd, "pickupPointId");
  const title = str(fd, "title");
  const deadlineAtRaw = str(fd, "deadlineAt");
  const minTotalSum = Math.trunc(num(fd, "minTotalSum"));

  if (!supplierId) return { ok: false, message: "Выбери поставщика." };
  if (!settlementId) return { ok: false, message: "Выбери населённый пункт." };
  if (!pickupPointId) return { ok: false, message: "Выбери пункт выдачи." };
  if (!title) return { ok: false, message: "Название закупки не может быть пустым." };
  if (!deadlineAtRaw) return { ok: false, message: "Укажи дедлайн." };
  if (!Number.isFinite(minTotalSum) || minTotalSum < 0) return { ok: false, message: "Мин. сумма должна быть ≥ 0." };

  const deadlineAt = new Date(deadlineAtRaw);
  if (Number.isNaN(deadlineAt.getTime())) return { ok: false, message: "Некорректная дата дедлайна." };

  // генерим уникальный inviteCode
  let inviteCode = makeCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.procurement.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = makeCode();
  }

  try {
    await prisma.procurement.create({
      data: {
        supplierId,
        settlementId,
        pickupPointId,
        title,
        inviteCode,
        deadlineAt,
        minTotalSum,
        status: "OPEN",
      },
    });

    revalidatePath("/admin/procurements");
    return { ok: true, message: `Закупка создана. Код: ${inviteCode}` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Ошибка при создании закупки (смотри терминал)." };
  }
}

export async function closeProcurement(fd) {
  const id = str(fd, "id");
  if (!id) throw new Error("Не передан id закупки.");

  await prisma.procurement.update({
    where: { id },
    data: { status: "CLOSED" },
  });

  revalidatePath("/admin/procurements");
}
