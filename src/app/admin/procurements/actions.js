"use server";

import { prisma } from "@/lib/db";
import { str, num } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { createNotificationsMany } from "@/lib/notifications";
import { requireOperatorOrAdminResult, assertOperatorOrAdmin } from "@/lib/guards";

function makeCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function createProcurement(_prev, fd) {
  const { session, fail } = await requireOperatorOrAdminResult();
  if (fail) return fail;
  const actorLabel = session.email ?? "admin";
  const isOperator = session.role === "OPERATOR";

  let supplierId = str(fd, "supplierId");
  let settlementId = str(fd, "settlementId");
  let pickupPointId = str(fd, "pickupPointId");

  // OPERATOR: force their pickupPoint and derive settlementId from it
  if (isOperator) {
    if (!session.pickupPointId) {
      return { ok: false, message: "Оператор не привязан к пункту выдачи." };
    }
    pickupPointId = String(session.pickupPointId);
    const pp = await prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: { settlementId: true },
    });
    if (!pp) return { ok: false, message: "Пункт выдачи оператора не найден." };
    settlementId = pp.settlementId;
  }

  const title = str(fd, "title");
  const deadlineAtRaw = str(fd, "deadlineAt");
  const minTotalSum = Math.trunc(num(fd, "minTotalSum"));

  // Pickup window (optional)
  const pickupWindowStartRaw = str(fd, "pickupWindowStart");
  const pickupWindowEndRaw = str(fd, "pickupWindowEnd");
  const pickupInstructions = str(fd, "pickupInstructions") || null;

  if (!supplierId) return { ok: false, message: "Выбери поставщика." };
  if (!settlementId) return { ok: false, message: "Выбери населённый пункт." };
  if (!pickupPointId) return { ok: false, message: "Выбери пункт выдачи." };
  if (!title) return { ok: false, message: "Название закупки не может быть пустым." };
  if (!deadlineAtRaw) return { ok: false, message: "Укажи дедлайн." };
  if (!Number.isFinite(minTotalSum) || minTotalSum < 0)
    return { ok: false, message: "Мин. сумма должна быть ≥ 0." };

  const deadlineAt = new Date(deadlineAtRaw);
  if (Number.isNaN(deadlineAt.getTime())) return { ok: false, message: "Некорректная дата дедлайна." };
  if (deadlineAt <= new Date()) return { ok: false, message: "Дедлайн должен быть в будущем." };

  const pickupWindowStart = pickupWindowStartRaw ? new Date(pickupWindowStartRaw) : null;
  const pickupWindowEnd = pickupWindowEndRaw ? new Date(pickupWindowEndRaw) : null;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { isActive: true } });
  if (!supplier) return { ok: false, message: "Поставщик не найден." };
  if (!supplier.isActive) return { ok: false, message: "Поставщик неактивен. Активируй его перед созданием закупки." };

  const zone = await prisma.supplierDeliveryZone.findUnique({
    where: { supplierId_settlementId: { supplierId, settlementId } },
    select: { isActive: true },
  });
  if (!zone || !zone.isActive) {
    return { ok: false, message: "У поставщика нет активной зоны доставки для выбранного населённого пункта." };
  }

  const pickup = await prisma.pickupPoint.findUnique({ where: { id: pickupPointId }, select: { settlementId: true } });
  if (!pickup) return { ok: false, message: "Пункт выдачи не найден." };
  if (pickup.settlementId !== settlementId) {
    return { ok: false, message: "Пункт выдачи не относится к выбранному населённому пункту." };
  }

  let inviteCode = null;
  for (let i = 0; i < 10; i++) {
    const candidate = makeCode();
    const exists = await prisma.procurement.findUnique({ where: { inviteCode: candidate } });
    if (!exists) {
      inviteCode = candidate;
      break;
    }
  }
  if (!inviteCode) return { ok: false, message: "Не удалось сгенерировать уникальный код. Попробуй ещё раз." };

  try {
    const procurement = await prisma.procurement.create({
      data: {
        supplierId,
        settlementId,
        pickupPointId,
        title,
        inviteCode,
        deadlineAt,
        minTotalSum,
        status: "OPEN",
        pickupWindowStart,
        pickupWindowEnd,
        pickupInstructions,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorLabel,
        action: "CREATE_PROCUREMENT",
        entityType: "PROCUREMENT",
        entityId: procurement.id,
        meta: { title, inviteCode },
      },
    });

    // Notify all RESIDENT users in the procurement's settlement
    const residents = await prisma.user.findMany({
      where: { settlementId, role: "RESIDENT" },
      select: { id: true },
    });
    await createNotificationsMany(
      residents.map((u) => u.id),
      {
        type: "PROCUREMENT_CREATED",
        title: "Новая закупка",
        body: `Открыта закупка «${title}». Успейте оформить заявку!`,
        linkUrl: `/p/${inviteCode}`,
      }
    );

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

  const session = await assertOperatorOrAdmin();
  const actorLabel = session.email ?? "admin";

  const procurement = await prisma.procurement.update({
    where: { id },
    data: { status: "CLOSED" },
    select: { title: true },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "CLOSE_PROCUREMENT",
      entityType: "PROCUREMENT",
      entityId: id,
    },
  });

  // Notify users who submitted orders
  const submittedOrders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED", userId: { not: null } },
    select: { userId: true },
  });
  const userIds = [...new Set(submittedOrders.map((o) => o.userId).filter(Boolean))];
  await createNotificationsMany(userIds, {
    type: "PROCUREMENT_CLOSED",
    title: "Закупка закрыта",
    body: `Закупка «${procurement.title}» закрыта. Ожидайте информацию о выдаче.`,
    linkUrl: "/my/orders",
  });

  revalidatePath("/admin/procurements");
}
