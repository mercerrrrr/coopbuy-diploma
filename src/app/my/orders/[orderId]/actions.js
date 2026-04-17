"use server";

import { prisma } from "@/lib/db";
import { assertResident } from "@/lib/guards";
import { paymentsApi } from "@/lib/yookassa";
import { writeOrderAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";

function buildReceipt(session, order) {
  const items = order.items.map((item) => ({
    description: item.product.name,
    quantity: String(item.qty),
    amount: {
      value: item.price.toFixed(2),
      currency: "RUB",
    },
    vat_code: 1,
    payment_subject: "commodity",
    payment_mode: "full_payment",
  }));

  return {
    customer: {
      email: session.email,
      ...(order.participantPhone && { phone: order.participantPhone }),
    },
    items,
  };
}

export async function createPayment(fd) {
  const session = await assertResident();
  const userId = String(session.sub);
  const orderId = fd.get("orderId");

  if (!orderId) throw new Error("orderId missing");

  const order = await prisma.order.findUnique({
    where: { id: String(orderId) },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentStatus: true,
      goodsTotal: true,
      paymentAttempt: true,
      procurementId: true,
      participantPhone: true,
      procurement: { select: { title: true } },
      items: {
        select: {
          qty: true,
          price: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new Error("Заказ не найден.");
  }
  if (order.status !== "SUBMITTED") {
    throw new Error("Заказ не в статусе оформления.");
  }
  if (!["UNPAID", "FAILED"].includes(order.paymentStatus)) {
    throw new Error("Оплата уже инициирована или завершена.");
  }
  if (!order.goodsTotal || order.goodsTotal <= 0) {
    throw new Error("Сумма заказа должна быть больше нуля.");
  }

  // Online payment covers goods only — delivery is paid at pickup
  const attempt = order.paymentAttempt + 1;
  const idempotenceKey = `order-${order.id}-${attempt}`;
  const amountValue = order.goodsTotal.toFixed(2);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl = `${baseUrl}/my/orders/${order.id}?payment=pending`;

  let confirmationUrl;
  try {
    const { data: payment } = await paymentsApi.paymentsPost(
      idempotenceKey,
      {
        amount: { value: amountValue, currency: "RUB" },
        confirmation: { type: "redirect", return_url: returnUrl },
        capture: true,
        description: `CoopBuy: ${order.procurement.title} — заказ ${order.id.slice(-6)}`,
        metadata: { orderId: order.id },
        receipt: buildReceipt(session, order),
      },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: {
        yookassaPaymentId: payment.id,
        paymentStatus: "PENDING",
        paymentAttempt: attempt,
      },
    });

    await writeOrderAudit({
      actorType: "PUBLIC",
      actorLabel: session.email ?? "resident",
      action: "ONLINE_PAYMENT_CREATED",
      orderId: order.id,
      procurementId: order.procurementId,
      meta: { yookassaPaymentId: payment.id, attempt, amountValue },
    });

    logger.info(
      { op: "createPayment", orderId: order.id, paymentId: payment.id, attempt },
      "payment created",
    );

    confirmationUrl = payment.confirmation.confirmation_url;
  } catch (err) {
    logger.error({ err, op: "createPayment", orderId: order.id }, "payment creation failed");
    throw new Error("Не удалось создать платёж. Попробуйте позже.");
  }

  // redirect() must be outside try/catch — it throws NEXT_REDIRECT internally
  redirect(confirmationUrl);
}
