"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { str, num } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { recalcDeliveryShares } from "@/lib/deliveryShares";
import { createNotification } from "@/lib/notifications";
import { submitOrderSchema } from "@/lib/validation";
import { firstZodError } from "@/lib/zodError";

async function getOrCreateGuestId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get("cb_guest")?.value;
  if (existing) return existing;
  const guestId = crypto.randomUUID();
  cookieStore.set("cb_guest", guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return guestId;
}

async function getGuestId() {
  const cookieStore = await cookies();
  return cookieStore.get("cb_guest")?.value ?? null;
}

/**
 * Returns { userId } if RESIDENT session active, else { guestId }.
 * create=true: creates guestId cookie if needed.
 */
async function getIdentity(create = false) {
  const session = await getSession();
  if (session?.sub) return { userId: String(session.sub) };
  const guestId = create ? await getOrCreateGuestId() : await getGuestId();
  return { guestId };
}

function orderWhere(procurementId, identity, status) {
  return {
    procurementId,
    ...(identity.userId ? { userId: identity.userId } : { guestId: identity.guestId }),
    ...(status ? { status } : {}),
  };
}

export async function addToCart(fd) {
  const procurementId = str(fd, "procurementId");
  const productId = str(fd, "productId");
  const qty = Math.trunc(num(fd, "qty"));

  if (!procurementId) throw new Error("procurementId missing");
  if (!productId) throw new Error("productId missing");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("qty invalid");

  const procurement = await prisma.procurement.findUnique({
    where: { id: procurementId },
    select: { status: true, supplierId: true, deadlineAt: true },
  });
  if (!procurement) throw new Error("Закупка не найдена.");
  if (procurement.status !== "OPEN") throw new Error("Закупка уже недоступна для заказов.");
  if (new Date() > procurement.deadlineAt) throw new Error("Дедлайн закупки истёк.");

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Товар не найден.");
  if (product.supplierId !== procurement.supplierId) {
    throw new Error("Товар не принадлежит поставщику данной закупки.");
  }

  const identity = await getIdentity(true);

  const submitted = await prisma.order.findFirst({
    where: orderWhere(procurementId, identity, "SUBMITTED"),
  });
  if (submitted) throw new Error("Заявка уже оформлена. Редактирование недоступно.");

  await prisma.$transaction(async (tx) => {
    let order = await tx.order.findFirst({
      where: orderWhere(procurementId, identity, "DRAFT"),
    });

    if (!order) {
      order = await tx.order.create({
        data: {
          procurementId,
          status: "DRAFT",
          ...(identity.userId ? { userId: identity.userId } : { guestId: identity.guestId }),
        },
      });
    }

    const existing = await tx.orderItem.findFirst({
      where: { orderId: order.id, productId },
    });

    if (existing) {
      await tx.orderItem.update({
        where: { id: existing.id },
        data: { qty: existing.qty + qty, price: product.price },
      });
    } else {
      await tx.orderItem.create({
        data: { orderId: order.id, productId, qty, price: product.price },
      });
    }
  });

  revalidatePath(`/p/${str(fd, "code")}`);
}

export async function removeFromCart(fd) {
  const itemId = str(fd, "itemId");
  const code = str(fd, "code");
  const identity = await getIdentity(false);

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { guestId: true, userId: true, status: true } } },
  });
  if (!item) throw new Error("Позиция не найдена.");
  if (item.order.status !== "DRAFT") throw new Error("Заказ уже оформлен.");
  if (identity.userId) {
    if (item.order.userId !== identity.userId) throw new Error("Нет доступа.");
  } else {
    if (item.order.guestId !== identity.guestId) throw new Error("Нет доступа.");
  }

  await prisma.orderItem.delete({ where: { id: itemId } });
  revalidatePath(`/p/${code}`);
}

export async function decreaseQty(fd) {
  const itemId = str(fd, "itemId");
  const code = str(fd, "code");
  const identity = await getIdentity(false);

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { guestId: true, userId: true, status: true } } },
  });
  if (!item) throw new Error("Позиция не найдена.");
  if (item.order.status !== "DRAFT") throw new Error("Заказ уже оформлен.");
  if (identity.userId) {
    if (item.order.userId !== identity.userId) throw new Error("Нет доступа.");
  } else {
    if (item.order.guestId !== identity.guestId) throw new Error("Нет доступа.");
  }

  if (item.qty <= 1) {
    await prisma.orderItem.delete({ where: { id: itemId } });
  } else {
    await prisma.orderItem.update({ where: { id: itemId }, data: { qty: item.qty - 1 } });
  }
  revalidatePath(`/p/${code}`);
}

export async function clearCart(fd) {
  const procurementId = str(fd, "procurementId");
  const code = str(fd, "code");
  const identity = await getIdentity(false);
  if (!identity.userId && !identity.guestId) return;

  const order = await prisma.order.findFirst({
    where: orderWhere(procurementId, identity, "DRAFT"),
  });
  if (!order) return;

  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
    prisma.order.delete({ where: { id: order.id } }),
  ]);
  revalidatePath(`/p/${code}`);
}

export async function submitOrder(_prev, fd) {
  const procurementId = str(fd, "procurementId");
  const code = str(fd, "code");
  const participantName = str(fd, "participantName");
  const participantPhone = str(fd, "participantPhone");

  const parse = submitOrderSchema.safeParse({ participantName, participantPhone });
  if (!parse.success) {
    return { ok: false, message: firstZodError(parse.error) };
  }

  // Require RESIDENT auth
  const session = await getSession();
  if (!session) return { ok: false, message: "Необходимо войти в систему." };
  if (session.role !== "RESIDENT")
    return { ok: false, message: "Только участники могут оформлять заявки." };

  const userId = String(session.sub);

  const procurement = await prisma.procurement.findUnique({
    where: { id: procurementId },
    select: { status: true, deadlineAt: true },
  });
  if (!procurement) return { ok: false, message: "Закупка не найдена." };
  if (procurement.status !== "OPEN") return { ok: false, message: "Закупка закрыта." };
  if (new Date() > procurement.deadlineAt) return { ok: false, message: "Дедлайн истёк." };

  const order = await prisma.order.findFirst({
    where: { procurementId, userId, status: "DRAFT" },
    include: { items: true },
  });
  if (!order) return { ok: false, message: "Корзина пуста или заявка уже оформлена." };
  if (order.items.length === 0) return { ok: false, message: "Корзина пуста." };

  const goodsTotal = order.items.reduce((s, i) => s + i.qty * i.price, 0);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SUBMITTED",
      participantName,
      participantPhone: participantPhone || null,
      goodsTotal,
    },
  });

  // Recalculate delivery shares for all SUBMITTED orders (including this one)
  await recalcDeliveryShares(procurementId);

  await prisma.auditLog.create({
    data: {
      actorType: "PUBLIC",
      actorLabel: String(session.email),
      action: "SUBMIT_ORDER",
      entityType: "ORDER",
      entityId: procurementId,
      meta: { orderId: order.id, participantName, userId, goodsTotal },
    },
  });

  // Notify the resident
  await createNotification({
    userId,
    type: "ORDER_SUBMITTED",
    title: "Заявка принята",
    body: `Ваша заявка на закупку успешно оформлена. Сумма товаров: ${goodsTotal} ₽.`,
    linkUrl: `/my/orders/${order.id}`,
  });

  revalidatePath(`/p/${code}`);
  return { ok: true, message: "Заявка принята!" };
}
