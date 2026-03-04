"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { str, num } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { recalcDeliveryShares } from "@/lib/deliveryShares";
import { createNotification } from "@/lib/notifications";
import { assertOrderBelongsToProcurement, assertOrderCanCheckin } from "./checkinGuard";

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
          unit: p.unit,
          totalQty: 0,
        });
      }
      aggMap.get(p.id).totalQty += item.qty;
    }
  }
  return aggMap;
}

export async function createReceivingReport(fd) {
  const procurementId = str(fd, "procurementId");
  const id = str(fd, "id"); // procurement page id for revalidate

  if (!procurementId) throw new Error("procurementId missing");

  // Check not already exists
  const existing = await prisma.receivingReport.findUnique({ where: { procurementId } });
  if (existing) throw new Error("Акт приёмки уже существует.");

  const aggMap = await buildAggMap(procurementId);
  if (aggMap.size === 0) throw new Error("Нет подтверждённых заявок для создания акта.");

  const report = await prisma.receivingReport.create({
    data: {
      procurementId,
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

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel: "admin",
      action: "CREATE_RECEIVING",
      entityType: "RECEIVING",
      entityId: procurementId,
      meta: { reportId: report.id },
    },
  });

  revalidatePath(`/admin/procurements/${id}`);
}

export async function updateReceivingLine(fd) {
  const lineId = str(fd, "lineId");
  const procurementId = str(fd, "procurementId");
  const receivedQty = Math.trunc(num(fd, "receivedQty"));
  const comment = str(fd, "comment") || null;

  if (!lineId) throw new Error("lineId missing");
  if (!Number.isFinite(receivedQty) || receivedQty < 0) throw new Error("Недопустимое значение кол-ва.");

  const line = await prisma.receivingLine.findUnique({
    where: { id: lineId },
    include: { report: { select: { status: true, id: true } } },
  });
  if (!line) throw new Error("Строка не найдена.");
  if (line.report.status === "FINAL") throw new Error("Акт финализирован. Редактирование заблокировано.");

  await prisma.receivingLine.update({
    where: { id: lineId },
    data: { receivedQty, comment },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel: "admin",
      action: "UPDATE_RECEIVING_LINE",
      entityType: "RECEIVING",
      entityId: procurementId,
      meta: { lineId, receivedQty, comment },
    },
  });

  revalidatePath(`/admin/procurements/${procurementId}`);
}

export async function createPickupSession(fd) {
  const procurementId = str(fd, "procurementId");
  if (!procurementId) throw new Error("procurementId missing");

  const session = await getSession();
  const actorLabel = session?.email ?? "admin";

  const startAtRaw = str(fd, "startAt");
  const endAtRaw = str(fd, "endAt");

  const existing = await prisma.pickupSession.findUnique({ where: { procurementId } });
  if (existing) throw new Error("Сессия выдачи уже создана для этой закупки.");

  const created = await prisma.pickupSession.create({
    data: {
      procurementId,
      status: "PLANNED",
      startAt: startAtRaw ? new Date(startAtRaw) : null,
      endAt: endAtRaw ? new Date(endAtRaw) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "CREATE_PICKUP_SESSION",
      entityType: "PROCUREMENT",
      entityId: procurementId,
      meta: { sessionId: created.id },
    },
  });

  revalidatePath(`/admin/procurements/${procurementId}`);
}

export async function checkinOrder(fd) {
  const procurementId = str(fd, "procurementId");
  const sessionId = str(fd, "sessionId");
  const orderId = str(fd, "orderId");
  const note = str(fd, "note") || null;

  if (!sessionId) throw new Error("sessionId missing");
  if (!orderId) throw new Error("orderId missing");

  const session = await getSession();
  const actorLabel = session?.email ?? "admin";
  const operatorUserId = session?.sub ? String(session.sub) : null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentStatus: true, userId: true, participantName: true, procurementId: true },
  });
  assertOrderBelongsToProcurement(order, procurementId);
  assertOrderCanCheckin(order);

  const existingCheckin = await prisma.pickupCheckin.findUnique({ where: { orderId } });
  if (existingCheckin) throw new Error("Эта заявка уже выдана.");

  await prisma.pickupCheckin.create({
    data: { sessionId, orderId, note, operatorUserId },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "CHECKIN_ORDER",
      entityType: "PROCUREMENT",
      entityId: procurementId,
      meta: { orderId, sessionId },
    },
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

  revalidatePath(`/admin/procurements/${procurementId}`);
}

export async function closePickupSession(fd) {
  const procurementId = str(fd, "procurementId");
  const sessionId = str(fd, "sessionId");

  if (!sessionId) throw new Error("sessionId missing");

  const session = await getSession();
  const actorLabel = session?.email ?? "admin";

  await prisma.pickupSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED" },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "CLOSE_PICKUP_SESSION",
      entityType: "PROCUREMENT",
      entityId: procurementId,
      meta: { sessionId },
    },
  });

  revalidatePath(`/admin/procurements/${procurementId}`);
}

// ── Delivery settings ─────────────────────────────────────

export async function updateDeliverySettings(_prev, fd) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    return { error: "Нет доступа." };
  }
  const actorLabel = session.email;

  const procurementId = str(fd, "procurementId");
  const deliveryFeeRaw = str(fd, "deliveryFee");
  const deliverySplitMode = str(fd, "deliverySplitMode");

  const deliveryFee = parseInt(deliveryFeeRaw, 10);
  if (isNaN(deliveryFee) || deliveryFee < 0) return { error: "Неверная стоимость доставки." };
  if (!["PROPORTIONAL_SUM", "EQUAL", "PER_ITEM"].includes(deliverySplitMode)) {
    return { error: "Неверный режим разделения." };
  }

  await prisma.procurement.update({
    where: { id: procurementId },
    data: { deliveryFee, deliverySplitMode },
  });

  await recalcDeliveryShares(procurementId);

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "UPDATE_DELIVERY_SETTINGS",
      entityType: "PROCUREMENT",
      entityId: procurementId,
      meta: { deliveryFee, deliverySplitMode },
    },
  });

  revalidatePath(`/admin/procurements/${procurementId}`);
  return { ok: true, message: "Настройки сохранены, доли пересчитаны." };
}

export async function recalcShares(fd) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    throw new Error("Нет доступа.");
  }
  const actorLabel = session.email;
  const procurementId = str(fd, "procurementId");

  await recalcDeliveryShares(procurementId);

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "RECALC_DELIVERY_SHARES",
      entityType: "PROCUREMENT",
      entityId: procurementId,
      meta: {},
    },
  });

  revalidatePath(`/admin/procurements/${procurementId}`);
}

// ── Payment status ─────────────────────────────────────────

export async function updatePaymentStatus(fd) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    throw new Error("Нет доступа.");
  }
  const actorLabel = session.email;

  const orderId = str(fd, "orderId");
  const procurementId = str(fd, "procurementId");
  const paymentStatus = str(fd, "paymentStatus");
  const paymentMethod = str(fd, "paymentMethod") || null;

  if (!orderId) throw new Error("orderId missing");
  if (!["PAID", "PAY_ON_PICKUP", "UNPAID"].includes(paymentStatus)) {
    throw new Error("Неверный статус оплаты.");
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
      paymentMethod: paymentStatus === "PAID" ? (paymentMethod || null) : null,
    },
    select: { userId: true },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel,
      action: "UPDATE_PAYMENT_STATUS",
      entityType: "ORDER",
      entityId: procurementId,
      meta: { orderId, paymentStatus, paymentMethod },
    },
  });

  // Notify the resident
  if (updatedOrder.userId) {
    const LABELS = { UNPAID: "Не оплачено", PAID: "Оплачено", PAY_ON_PICKUP: "Оплата при выдаче" };
    await createNotification({
      userId: updatedOrder.userId,
      type: "PAYMENT_STATUS_CHANGED",
      title: "Статус оплаты изменён",
      body: `Статус оплаты вашего заказа изменён на: ${LABELS[paymentStatus] ?? paymentStatus}.`,
      linkUrl: `/my/orders/${orderId}`,
    });
  }

  revalidatePath(`/admin/procurements/${procurementId}`);
}

// ── Receiving / finalize ───────────────────────────────────

export async function finalizeReceivingReport(fd) {
  const reportId = str(fd, "reportId");
  const procurementId = str(fd, "procurementId");

  if (!reportId) throw new Error("reportId missing");

  const report = await prisma.receivingReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Акт не найден.");
  if (report.status === "FINAL") throw new Error("Акт уже финализирован.");

  await prisma.receivingReport.update({
    where: { id: reportId },
    data: { status: "FINAL" },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel: "admin",
      action: "FINALIZE_RECEIVING",
      entityType: "RECEIVING",
      entityId: procurementId,
      meta: { reportId },
    },
  });

  revalidatePath(`/admin/procurements/${procurementId}`);
}
