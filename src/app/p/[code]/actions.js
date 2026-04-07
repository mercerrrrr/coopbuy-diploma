"use server";

import { prisma } from "@/lib/db";
import { str, num } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { recalcDeliveryShares } from "@/lib/deliveryShares";
import { createNotification } from "@/lib/notifications";
import { submitOrderSchema } from "@/lib/validation";
import { firstZodError } from "@/lib/zodError";
import {
  getResidentProcurementAccessById,
  canResidentParticipateInProcurement,
} from "@/lib/guards";
import { writeOrderAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { getItemsGoodsTotal } from "@/lib/orders";

function orderWhere(procurementId, userId, status) {
  return {
    procurementId,
    userId,
    ...(status ? { status } : {}),
  };
}

function redirectToProcurement(code, message, flashType = "error") {
  const params = new URLSearchParams();
  params.set("flash", message);
  params.set("flashType", flashType);
  redirect(`/p/${code}?${params.toString()}`);
}

export async function addToCart(fd) {
  const code = str(fd, "code");
  const procurementId = str(fd, "procurementId");
  const productId = str(fd, "productId");
  const qty = Math.trunc(num(fd, "qty"));

  if (!procurementId || !code) throw new Error("procurementId or code missing");
  if (!productId) redirectToProcurement(code, "Товар не найден.");
  if (!Number.isFinite(qty) || qty <= 0) {
    redirectToProcurement(code, "Укажите корректное количество товара.");
  }

  const { session, procurement, access } = await getResidentProcurementAccessById(procurementId, {
    select: { id: true, status: true, supplierId: true, deadlineAt: true, settlementId: true, minTotalSum: true },
  });
  if (!procurement) redirectToProcurement(code, "Закупка не найдена.");
  if (!canResidentParticipateInProcurement(access)) {
    redirectToProcurement(code, access.message);
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) redirectToProcurement(code, "Товар не найден.");
  if (product.supplierId !== procurement.supplierId) {
    redirectToProcurement(code, "Товар не принадлежит поставщику этой закупки.");
  }

  const userId = String(session.sub);

  const submitted = await prisma.order.findFirst({
    where: orderWhere(procurementId, userId, "SUBMITTED"),
  });
  if (submitted) {
    redirectToProcurement(code, "Заявка уже оформлена. Редактирование корзины недоступно.");
  }

  await prisma.$transaction(async (tx) => {
    let order = await tx.order.findFirst({
      where: orderWhere(procurementId, userId, "DRAFT"),
    });

    if (!order) {
      order = await tx.order.create({
        data: {
          procurementId,
          status: "DRAFT",
          userId,
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

  revalidatePath(`/p/${code}`);
}

export async function removeFromCart(fd) {
  const itemId = str(fd, "itemId");
  const code = str(fd, "code");
  if (!itemId || !code) throw new Error("itemId or code missing");

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { userId: true, status: true, procurementId: true } } },
  });
  if (!item) redirectToProcurement(code, "Позиция корзины не найдена.");

  const { session, access } = await getResidentProcurementAccessById(item.order.procurementId, {
    select: { id: true, status: true, deadlineAt: true, settlementId: true, minTotalSum: true },
  });
  if (!canResidentParticipateInProcurement(access)) {
    redirectToProcurement(code, access.message);
  }
  if (item.order.status !== "DRAFT") redirectToProcurement(code, "Заказ уже оформлен.");
  if (item.order.userId !== String(session.sub)) {
    redirectToProcurement(code, "Нельзя изменять чужую корзину.");
  }

  await prisma.orderItem.delete({ where: { id: itemId } });
  revalidatePath(`/p/${code}`);
}

export async function decreaseQty(fd) {
  const itemId = str(fd, "itemId");
  const code = str(fd, "code");
  if (!itemId || !code) throw new Error("itemId or code missing");

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { userId: true, status: true, procurementId: true } } },
  });
  if (!item) redirectToProcurement(code, "Позиция корзины не найдена.");

  const { session, access } = await getResidentProcurementAccessById(item.order.procurementId, {
    select: { id: true, status: true, deadlineAt: true, settlementId: true, minTotalSum: true },
  });
  if (!canResidentParticipateInProcurement(access)) {
    redirectToProcurement(code, access.message);
  }
  if (item.order.status !== "DRAFT") redirectToProcurement(code, "Заказ уже оформлен.");
  if (item.order.userId !== String(session.sub)) {
    redirectToProcurement(code, "Нельзя изменять чужую корзину.");
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
  if (!procurementId || !code) throw new Error("procurementId or code missing");

  const { session, access } = await getResidentProcurementAccessById(procurementId, {
    select: { id: true, status: true, deadlineAt: true, settlementId: true, minTotalSum: true },
  });
  if (!canResidentParticipateInProcurement(access)) {
    redirectToProcurement(code, access.message);
  }

  const order = await prisma.order.findFirst({
    where: orderWhere(procurementId, String(session.sub), "DRAFT"),
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

  const { session, procurement, access } = await getResidentProcurementAccessById(procurementId, {
    select: { id: true, status: true, deadlineAt: true, settlementId: true, minTotalSum: true },
  });
  if (!procurement) return { ok: false, message: "Закупка не найдена." };
  if (!canResidentParticipateInProcurement(access)) {
    return { ok: false, message: access.message };
  }

  const userId = String(session.sub);

  const order = await prisma.order.findFirst({
    where: { procurementId, userId, status: "DRAFT" },
    include: { items: true },
  });
  if (!order) return { ok: false, message: "Корзина пуста или заявка уже оформлена." };
  if (order.items.length === 0) return { ok: false, message: "Корзина пуста." };

  const goodsTotal = getItemsGoodsTotal(order.items);

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

  await writeOrderAudit({
    actorType: "PUBLIC",
    actorLabel: String(session.email),
    action: "SUBMIT_ORDER",
    orderId: order.id,
    procurementId,
    meta: { participantName, userId, goodsTotal },
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
