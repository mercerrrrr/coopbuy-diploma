import { createNotificationsMany, createNotification } from "@/lib/notifications";
import { writeProcurementAudit, writeOrderAudit } from "@/lib/audit";
import { refundsApi } from "@/lib/yookassa";
import { getOrdersGoodsTotal } from "@/lib/orders";
import { logger } from "@/lib/logger";

/**
 * If the procurement's minTotalSum was not reached, automatically refunds
 * all PAID online orders via YooKassa and marks PENDING orders as FAILED.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} procurementId
 * @param {string} actorLabel
 * @returns {Promise<{refunded: number, failed: number, pendingCancelled: number}>}
 */
export async function refundPaidOrdersIfMinNotReached(prisma, procurementId, actorLabel) {
  const zero = { refunded: 0, failed: 0, pendingCancelled: 0 };

  const procurement = await prisma.procurement.findUnique({
    where: { id: procurementId },
    select: { minTotalSum: true },
  });
  if (!procurement || procurement.minTotalSum <= 0) return zero;

  const orders = await prisma.order.findMany({
    where: { procurementId, status: "SUBMITTED" },
    select: {
      id: true,
      userId: true,
      paymentStatus: true,
      yookassaPaymentId: true,
      goodsTotal: true,
      items: { select: { qty: true, price: true } },
    },
  });

  const submittedTotal = getOrdersGoodsTotal(orders);
  if (submittedTotal >= procurement.minTotalSum) return zero;

  const paidOrders = orders.filter(
    (o) => o.paymentStatus === "PAID" && o.yookassaPaymentId,
  );
  const pendingOrders = orders.filter((o) => o.paymentStatus === "PENDING");

  let refunded = 0;
  let failed = 0;
  let pendingCancelled = 0;

  for (const order of paidOrders) {
    const idempotenceKey = `refund-autoclose-${order.id}`;
    const refundTotal = order.goodsTotal ?? 0;
    const amountValue = (refundTotal / 100).toFixed(2);

    try {
      await refundsApi.refundsPost(idempotenceKey, {
        payment_id: order.yookassaPaymentId,
        amount: { value: amountValue, currency: "RUB" },
        description: "Автовозврат — минимальная сумма закупки не достигнута",
      });
    } catch (err) {
      logger.error({ err, op: "autoRefund", orderId: order.id }, "auto-refund failed");
      failed++;
      continue;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REFUNDED", refundedAt: new Date(), refundAmount: refundTotal },
    });

    await writeOrderAudit({
      actorType: "ADMIN",
      actorLabel,
      action: "ONLINE_PAYMENT_REFUNDED",
      orderId: order.id,
      procurementId,
      meta: { refundAmount: refundTotal, amountValue, reason: "min_not_reached" },
    });

    if (order.userId) {
      await createNotification({
        userId: order.userId,
        type: "PAYMENT_STATUS_CHANGED",
        title: "Возврат средств",
        body: `Минимальная сумма закупки не была достигнута. Оплата ${amountValue} ₽ возвращена.`,
        linkUrl: `/my/orders/${order.id}`,
      });
    }

    refunded++;
  }

  for (const order of pendingOrders) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });

    await writeOrderAudit({
      actorType: "ADMIN",
      actorLabel,
      action: "ONLINE_PAYMENT_FAILED",
      orderId: order.id,
      procurementId,
      meta: { reason: "min_not_reached_procurement_closed" },
    });

    if (order.userId) {
      await createNotification({
        userId: order.userId,
        type: "PAYMENT_STATUS_CHANGED",
        title: "Оплата отменена",
        body: "Минимальная сумма закупки не была достигнута. Платёж отменён.",
        linkUrl: `/my/orders/${order.id}`,
      });
    }

    pendingCancelled++;
  }

  logger.info(
    { op: "autoRefund", procurementId, refunded, failed, pendingCancelled },
    "auto-refund complete",
  );
  return { refunded, failed, pendingCancelled };
}

/**
 * Sends a PROCUREMENT_CLOSED notification to all residents with SUBMITTED orders
 * in the given procurement. Shared between manual and automatic closure paths.
 */
export async function notifyProcurementClosed(prisma, procurementId, title) {
  const submittedOrders = await prisma.order.findMany({
    where: { procurementId, status: "SUBMITTED", userId: { not: null } },
    select: { userId: true, id: true, deliveryShare: true },
  });
  if (submittedOrders.length === 0) return 0;

  // Send individual notifications with final delivery share
  for (const order of submittedOrders) {
    if (!order.userId) continue;
    const deliveryInfo =
      order.deliveryShare && order.deliveryShare > 0
        ? ` Доставка: ${order.deliveryShare} ₽ (оплачивается при получении).`
        : "";
    await createNotification({
      userId: order.userId,
      type: "PROCUREMENT_CLOSED",
      title: "Закупка закрыта",
      body: `Закупка «${title}» закрыта.${deliveryInfo} Ожидайте информацию о выдаче.`,
      linkUrl: `/my/orders/${order.id}`,
    });
  }
  return submittedOrders.length;
}

/**
 * Closes all OPEN procurements whose deadline has passed.
 * For each closed procurement: writes a PROCUREMENT_AUTO_CLOSED audit entry
 * and notifies residents with SUBMITTED orders.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {Date} [now]
 * @returns {Promise<number>} count of closed procurements
 */
export async function autoCloseExpiredProcurements(prisma, now = new Date()) {
  const expired = await prisma.procurement.findMany({
    where: { status: "OPEN", deadlineAt: { lte: now } },
    select: { id: true, title: true },
  });
  if (expired.length === 0) return 0;

  for (const p of expired) {
    await prisma.procurement.update({
      where: { id: p.id },
      data: { status: "CLOSED" },
    });
    await writeProcurementAudit({
      actorType: "ADMIN",
      actorLabel: "system",
      action: "PROCUREMENT_AUTO_CLOSED",
      procurementId: p.id,
      meta: { reason: "deadline_expired" },
    });
    await refundPaidOrdersIfMinNotReached(prisma, p.id, "system");
    await notifyProcurementClosed(prisma, p.id, p.title);
  }
  return expired.length;
}
