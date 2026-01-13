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

export async function addToCart(fd) {
  const procurementId = str(fd, "procurementId");
  const productId = str(fd, "productId");
  const qty = Math.trunc(num(fd, "qty"));

  if (!procurementId) throw new Error("procurementId missing");
  if (!productId) throw new Error("productId missing");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("qty invalid");

  // MVP: одна "гостевая" заявка на закупку (потом будет auth)
  let order = await prisma.order.findFirst({
    where: { procurementId, status: "DRAFT", participantName: null, participantPhone: null },
  });

  if (!order) {
    order = await prisma.order.create({
      data: { procurementId, status: "DRAFT" },
    });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("product not found");

  // если позиция уже есть — увеличиваем qty
  const existing = await prisma.orderItem.findFirst({
    where: { orderId: order.id, productId },
  });

  if (existing) {
    await prisma.orderItem.update({
      where: { id: existing.id },
      data: { qty: existing.qty + qty, price: product.price },
    });
  } else {
    await prisma.orderItem.create({
      data: { orderId: order.id, productId, qty, price: product.price },
    });
  }

  revalidatePath(`/p/${str(fd, "code")}`);
}
