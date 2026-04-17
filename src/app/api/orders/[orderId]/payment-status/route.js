import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { paymentsApi } from "@/lib/yookassa";
import { createNotification } from "@/lib/notifications";
import { writeOrderAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { orderId } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      paymentStatus: true,
      yookassaPaymentId: true,
      procurementId: true,
    },
  });

  if (!order || order.userId !== String(session.sub)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // If PENDING and we have a yookassaPaymentId, check YooKassa API directly
  if (order.paymentStatus === "PENDING" && order.yookassaPaymentId) {
    try {
      const { data: payment } = await paymentsApi.paymentsPaymentIdGet(
        order.yookassaPaymentId,
      );

      if (payment.status === "succeeded" && order.paymentStatus !== "PAID") {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            paidAt: new Date(),
            paymentMethod: "ЮKassa онлайн",
          },
        });

        await writeOrderAudit({
          actorType: "SYSTEM",
          actorLabel: "payment-poller",
          action: "ONLINE_PAYMENT_SUCCEEDED",
          orderId,
          procurementId: order.procurementId,
          meta: { yookassaPaymentId: order.yookassaPaymentId, source: "poll" },
        });

        if (order.userId) {
          await createNotification({
            userId: order.userId,
            type: "PAYMENT_STATUS_CHANGED",
            title: "Оплата прошла",
            body: "Ваш платёж успешно обработан.",
            linkUrl: `/my/orders/${orderId}`,
          });
        }

        logger.info(
          { op: "paymentPoll", orderId, paymentId: order.yookassaPaymentId },
          "payment confirmed via poll",
        );

        return NextResponse.json({ paymentStatus: "PAID" });
      }

      if (payment.status === "canceled" && order.paymentStatus !== "FAILED") {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: "FAILED" },
        });

        await writeOrderAudit({
          actorType: "SYSTEM",
          actorLabel: "payment-poller",
          action: "ONLINE_PAYMENT_FAILED",
          orderId,
          procurementId: order.procurementId,
          meta: { yookassaPaymentId: order.yookassaPaymentId, source: "poll" },
        });

        logger.info(
          { op: "paymentPoll", orderId, paymentId: order.yookassaPaymentId },
          "payment canceled via poll",
        );

        return NextResponse.json({ paymentStatus: "FAILED" });
      }
    } catch (err) {
      // If YooKassa API fails, just return current DB status
      logger.warn(
        { err, op: "paymentPoll", orderId },
        "failed to check payment status via YooKassa API",
      );
    }
  }

  return NextResponse.json({ paymentStatus: order.paymentStatus });
}
