import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeOrderAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { PAYMENT_LABELS } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ── YooKassa IP whitelist ─────────────────────────────────────────────────────

const YOOKASSA_RANGES = [
  { base: ipToInt("185.71.76.0"), mask: 27 },
  { base: ipToInt("185.71.77.0"), mask: 27 },
  { base: ipToInt("77.75.153.0"), mask: 25 },
  { base: ipToInt("77.75.156.11"), mask: 32 },
  { base: ipToInt("77.75.156.35"), mask: 32 },
];

function ipToInt(ip) {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isYookassaIp(ip) {
  if (!ip) return false;
  const addr = ipToInt(ip);
  return YOOKASSA_RANGES.some(({ base, mask }) => {
    const hostBits = 32 - mask;
    return (addr >>> hostBits) === (base >>> hostBits);
  });
}

function extractIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? null;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  const ip = extractIp(request);

  if (process.env.YOOKASSA_SKIP_IP_CHECK !== "true" && !isYookassaIp(ip)) {
    logger.warn({ ip, route: "webhooks/yookassa" }, "rejected: IP not in whitelist");
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = body.event;
  const paymentObj = body.object;
  const orderId = paymentObj?.metadata?.orderId;

  if (!event || !paymentObj?.id || !orderId) {
    logger.warn({ route: "webhooks/yookassa", event }, "missing required fields");
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    if (event === "payment.succeeded") {
      await handleSucceeded(orderId, paymentObj);
    } else if (event === "payment.canceled") {
      await handleCanceled(orderId, paymentObj);
    } else {
      logger.info({ route: "webhooks/yookassa", event }, "unknown event, ignoring");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "webhooks/yookassa", event, orderId }, "webhook processing failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleSucceeded(orderId, paymentObj) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, userId: true, procurementId: true },
  });

  if (!order) {
    logger.warn({ orderId, route: "webhooks/yookassa" }, "order not found, skipping");
    return;
  }

  // Idempotent: already paid
  if (order.paymentStatus === "PAID") {
    logger.info({ orderId, route: "webhooks/yookassa" }, "already PAID, skipping");
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID",
      paidAt: new Date(),
      paymentMethod: "ЮKassa онлайн",
      yookassaPaymentId: paymentObj.id,
    },
  });

  await writeOrderAudit({
    actorType: "PUBLIC",
    actorLabel: "yookassa-webhook",
    action: "ONLINE_PAYMENT_SUCCEEDED",
    orderId,
    procurementId: order.procurementId,
    meta: { yookassaPaymentId: paymentObj.id },
  });

  if (order.userId) {
    await createNotification({
      userId: order.userId,
      type: "PAYMENT_STATUS_CHANGED",
      title: "Оплата прошла успешно",
      body: `Ваш заказ оплачен онлайн через ЮKassa. Статус: ${PAYMENT_LABELS.PAID}.`,
      linkUrl: `/my/orders/${orderId}`,
    });
  }

  logger.info({ orderId, paymentId: paymentObj.id, route: "webhooks/yookassa" }, "payment succeeded");
}

async function handleCanceled(orderId, paymentObj) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, userId: true, procurementId: true },
  });

  if (!order) {
    logger.warn({ orderId, route: "webhooks/yookassa" }, "order not found, skipping");
    return;
  }

  // Don't overwrite a successful payment or already-failed status
  if (order.paymentStatus === "PAID" || order.paymentStatus === "FAILED") {
    logger.info({ orderId, status: order.paymentStatus, route: "webhooks/yookassa" }, "skipping cancel");
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: "FAILED" },
  });

  await writeOrderAudit({
    actorType: "PUBLIC",
    actorLabel: "yookassa-webhook",
    action: "ONLINE_PAYMENT_FAILED",
    orderId,
    procurementId: order.procurementId,
    meta: { yookassaPaymentId: paymentObj.id },
  });

  if (order.userId) {
    await createNotification({
      userId: order.userId,
      type: "PAYMENT_STATUS_CHANGED",
      title: "Оплата не прошла",
      body: "Платёж через ЮKassa был отклонён. Вы можете попробовать снова.",
      linkUrl: `/my/orders/${orderId}`,
    });
  }

  logger.info({ orderId, paymentId: paymentObj.id, route: "webhooks/yookassa" }, "payment canceled");
}
