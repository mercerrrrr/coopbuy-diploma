"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { str, num } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { recalcDeliveryShares } from "@/lib/deliveryShares";
import { createNotification } from "@/lib/notifications";
import { requireAccessibleProcurement } from "@/lib/guards";
import { writeOrderAudit, writeProcurementAudit } from "@/lib/audit";
import {
  getPaymentStatusTransitionError,
  isAllowedPaymentStatusTransition,
  PAYMENT_LABELS,
} from "@/lib/constants";
import {
  assertOrderBelongsToProcurement,
  assertOrderCanCheckin,
  assertPickupSessionCanCheckin,
} from "./checkinGuard";

/** Builds aggregated product map from SUBMITTED orders of a procurement */
async function buildAggMap(procurementId) {
  const orders = await prisma.order.findMany({
    where: { procurementId, status: "SUBMITTED" },
    include: { items: { include: { product: true } } },
  });

  const aggMap = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const p = item.product;
      if (!aggMap.has(p.id)) {
        aggMap.set(p.id, {
          productId: p.id,
          name: p.name,
          totalQty: 0,
        });
      }
      aggMap.get(p.id).totalQty += item.qty;
    }
  }
  return aggMap;
}

async function requireProcurementForAdminAction(procurementId, query = { select: { id: true } }) {
  if (!procurementId) throw new Error("Не указана закупка.");

  const { session, procurement } = await requireAccessibleProcurement(procurementId, query);
  if (!procurement) throw new Error("Закупка не найдена.");

  return { session, procurement };
}

async function requireProcurementForAdminResult(procurementId, query = { select: { id: true } }) {
  try {
    const { session, procurement } = await requireProcurementForAdminAction(
      procurementId,
      query
    );
    return { session, procurement, error: null };
  } catch (error) {
    return {
      session: null,
      procurement: null,
      error: error instanceof Error ? error.message : "Ошибка доступа.",
    };
  }
}

export async function createReceivingReport(fd) {
  const procurementId = str(fd, "procurementId");

  const { session, procurement } = await requireProcurementForAdminAction(procurementId);
  const actorLabel = session?.email ?? "system";

  // Check not already exists
  const existing = await prisma.receivingReport.findUnique({
    where: { procurementId: procurement.id },
  });
  if (existing) throw new Error("Акт приёмки уже существует.");

  const aggMap = await buildAggMap(procurement.id);
  if (aggMap.size === 0) throw new Error("Нет подтверждённых заявок для создания акта.");

  const report = await prisma.receivingReport.create({
    data: {
      procurementId: procurement.id,
      status: "DRAFT",
      lines: {
        create: Array.from(aggMap.values()).map((agg) => ({
          productId: agg.productId,
          expectedQty: agg.totalQty,
          receivedQty: agg.totalQty,
        })),
      },
    },
  });

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "CREATE_RECEIVING",
    procurementId: procurement.id,
    meta: { reportId: report.id },
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
}

export async function updateReceivingLine(fd) {
  const lineId = str(fd, "lineId");
  const receivedQty = Math.trunc(num(fd, "receivedQty"));
  const comment = str(fd, "comment") || null;

  if (!lineId) throw new Error("Не указана строка акта приёмки.");
  if (!Number.isFinite(receivedQty) || receivedQty < 0) throw new Error("Недопустимое количество.");
  if (comment && comment.length > 500) {
    throw new Error("Комментарий слишком длинный. Максимум 500 символов.");
  }

  const line = await prisma.receivingLine.findUnique({
    where: { id: lineId },
    include: { report: { select: { status: true, id: true, procurementId: true } } },
  });
  if (!line) throw new Error("Строка не найдена.");
  if (line.report.status === "FINAL") throw new Error("Акт финализирован. Редактирование заблокировано.");

  const { session, procurement } = await requireProcurementForAdminAction(
    line.report.procurementId
  );
  const actorLabel = session?.email ?? "system";

  await prisma.receivingLine.update({
    where: { id: lineId },
    data: { receivedQty, comment },
  });

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "UPDATE_RECEIVING_LINE",
    procurementId: procurement.id,
    meta: { lineId, receivedQty, comment },
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
}

export async function createPickupSession(fd) {
  const procurementId = str(fd, "procurementId");

  const { session, procurement } = await requireProcurementForAdminAction(procurementId);
  const actorLabel = session?.email ?? "system";

  const startAtRaw = str(fd, "startAt");
  const endAtRaw = str(fd, "endAt");

  const existing = await prisma.pickupSession.findUnique({
    where: { procurementId: procurement.id },
  });
  if (existing) throw new Error("Сессия выдачи уже создана для этой закупки.");

  const created = await prisma.pickupSession.create({
    data: {
      procurementId: procurement.id,
      status: "PLANNED",
      startAt: startAtRaw ? new Date(startAtRaw) : null,
      endAt: endAtRaw ? new Date(endAtRaw) : null,
    },
  });

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "CREATE_PICKUP_SESSION",
    procurementId: procurement.id,
    meta: { sessionId: created.id },
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
}

export async function checkinOrder(fd) {
  const sessionId = str(fd, "sessionId");
  const orderId = str(fd, "orderId");
  const note = str(fd, "note") || null;

  if (!sessionId) throw new Error("Не указана сессия выдачи.");
  if (!orderId) throw new Error("Не указана заявка.");

  const session = await getSession();
  const actorLabel = session?.email ?? "system";
  const operatorUserId = session?.sub ? String(session.sub) : null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentStatus: true, userId: true, participantName: true, procurementId: true },
  });
  if (!order) throw new Error("Заявка не найдена.");

  const { procurement } = await requireProcurementForAdminAction(order.procurementId);
  assertOrderBelongsToProcurement(order, procurement.id);
  assertOrderCanCheckin(order);

  const pickupSession = await prisma.pickupSession.findUnique({
    where: { id: sessionId },
    select: { id: true, procurementId: true, status: true },
  });
  assertPickupSessionCanCheckin(pickupSession, procurement.id);

  const existingCheckin = await prisma.pickupCheckin.findUnique({ where: { orderId } });
  if (existingCheckin) throw new Error("Эта заявка уже выдана.");

  await prisma.pickupCheckin.create({
    data: { sessionId: pickupSession.id, orderId, note, operatorUserId },
  });

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "CHECKIN_ORDER",
    procurementId: procurement.id,
    orderId,
    meta: { sessionId: pickupSession.id },
  });

  // Notify the resident
  if (order.userId) {
    await createNotification({
      userId: order.userId,
      type: "ORDER_ISSUED",
      title: "Заказ выдан",
      body: `Ваш заказ выдан. Пожалуйста, заберите его в пункте выдачи.`,
      linkUrl: `/my/orders/${orderId}`,
    });
  }

  revalidatePath(`/admin/procurements/${procurement.id}`);
}

export async function closePickupSession(_prev, fd) {
  const sessionId = str(fd, "sessionId");

  if (!sessionId) return { ok: false, message: "Не указана сессия выдачи." };

  const pickupSession = await prisma.pickupSession.findUnique({
    where: { id: sessionId },
    select: { id: true, procurementId: true, status: true },
  });
  if (!pickupSession) return { ok: false, message: "Сессия выдачи не найдена." };
  if (pickupSession.status === "CLOSED") {
    return { ok: false, message: "Сессия уже закрыта." };
  }

  const { session, procurement } = await requireProcurementForAdminAction(
    pickupSession.procurementId
  );
  const actorLabel = session?.email ?? "system";

  await prisma.pickupSession.update({
    where: { id: pickupSession.id },
    data: { status: "CLOSED" },
  });

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "CLOSE_PICKUP_SESSION",
    procurementId: procurement.id,
    meta: { sessionId: pickupSession.id },
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
  return { ok: true, message: "Сессия выдачи закрыта." };
}

// ── Delivery settings ─────────────────────────────────────

export async function updateDeliverySettings(_prev, fd) {
  const procurementId = str(fd, "procurementId");
  const deliveryFeeRaw = str(fd, "deliveryFee");
  const deliverySplitMode = str(fd, "deliverySplitMode");

  const { session, procurement, error } = await requireProcurementForAdminResult(procurementId);
  if (error) return { error };
  const actorLabel = session?.email ?? "system";

  const deliveryFee = parseInt(deliveryFeeRaw, 10);
  if (isNaN(deliveryFee) || deliveryFee < 0) return { error: "Неверная стоимость доставки." };
  if (!["PROPORTIONAL_SUM", "EQUAL", "PER_ITEM"].includes(deliverySplitMode)) {
    return { error: "Неверный режим разделения." };
  }

  await prisma.procurement.update({
    where: { id: procurement.id },
    data: { deliveryFee, deliverySplitMode },
  });

  await recalcDeliveryShares(procurement.id);

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "UPDATE_DELIVERY_SETTINGS",
    procurementId: procurement.id,
    meta: { deliveryFee, deliverySplitMode },
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
  return { ok: true, message: "Настройки сохранены, доли пересчитаны." };
}

export async function recalcShares(fd) {
  const procurementId = str(fd, "procurementId");
  if (!procurementId) throw new Error("Не указана закупка.");

  const { session, procurement } = await requireProcurementForAdminAction(procurementId);
  const actorLabel = session?.email ?? "system";

  await recalcDeliveryShares(procurement.id);

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "RECALC_DELIVERY_SHARES",
    procurementId: procurement.id,
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
}

// ── Payment status ─────────────────────────────────────────

export async function updatePaymentStatus(_prev, fd) {
  const orderId = str(fd, "orderId");
  const paymentStatus = str(fd, "paymentStatus");
  const paymentMethod = str(fd, "paymentMethod") || null;

  if (!orderId) {
    return { ok: false, error: "Не указана заявка." };
  }
  if (!["PAID", "PAY_ON_PICKUP", "UNPAID"].includes(paymentStatus)) {
    return { ok: false, error: "Некорректный статус оплаты." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { procurementId: true, userId: true, paymentStatus: true },
  });
  if (!order) return { ok: false, error: "Заявка не найдена." };

  if (order.paymentStatus === paymentStatus) {
    return { ok: false, error: getPaymentStatusTransitionError(order.paymentStatus, paymentStatus) };
  }
  if (!isAllowedPaymentStatusTransition(order.paymentStatus, paymentStatus)) {
    return { ok: false, error: getPaymentStatusTransitionError(order.paymentStatus, paymentStatus) };
  }

  const { session, procurement } = await requireProcurementForAdminAction(order.procurementId);
  const actorLabel = session?.email ?? "system";

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
      paymentMethod: paymentStatus === "PAID" ? (paymentMethod || null) : null,
    },
    select: { userId: true },
  });

  await writeOrderAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "UPDATE_PAYMENT_STATUS",
    orderId,
    procurementId: procurement.id,
    meta: { paymentStatus, paymentMethod },
  });

  // Notify the resident
  if (updatedOrder.userId) {
    await createNotification({
      userId: updatedOrder.userId,
      type: "PAYMENT_STATUS_CHANGED",
      title: "Статус оплаты изменён",
      body: `Статус оплаты вашего заказа изменён на: ${PAYMENT_LABELS[paymentStatus] ?? paymentStatus}.`,
      linkUrl: `/my/orders/${orderId}`,
    });
  }

  revalidatePath(`/admin/procurements/${procurement.id}`);
  return { ok: true, message: "Статус оплаты обновлён." };
}

// ── Receiving / finalize ───────────────────────────────────

export async function finalizeReceivingReport(fd) {
  const reportId = str(fd, "reportId");

  if (!reportId) throw new Error("Не указан акт приёмки.");

  const report = await prisma.receivingReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, procurementId: true },
  });
  if (!report) throw new Error("Акт не найден.");
  if (report.status === "FINAL") throw new Error("Акт уже финализирован.");

  const { session, procurement } = await requireProcurementForAdminAction(
    report.procurementId
  );
  const actorLabel = session?.email ?? "system";

  await prisma.receivingReport.update({
    where: { id: report.id },
    data: { status: "FINAL" },
  });

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel,
    action: "FINALIZE_RECEIVING",
    procurementId: procurement.id,
    meta: { reportId: report.id },
  });

  revalidatePath(`/admin/procurements/${procurement.id}`);
}
