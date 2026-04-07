import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const GUEST_COOKIE = "cb_guest";

export async function getGuestId() {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE)?.value ?? null;
}

export async function getOrCreateGuestId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE)?.value;
  if (existing) return existing;

  const guestId = crypto.randomUUID();
  cookieStore.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return guestId;
}

export async function clearGuestId() {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE);
}

export async function mergeGuestDraftOrdersIntoUser(userId) {
  if (!userId) {
    return { migratedOrders: 0, mergedOrders: 0 };
  }

  const guestId = await getGuestId();
  if (!guestId) {
    return { migratedOrders: 0, mergedOrders: 0 };
  }

  const guestOrders = await prisma.order.findMany({
    where: { guestId, status: "DRAFT" },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  if (guestOrders.length === 0) {
    await clearGuestId();
    return { migratedOrders: 0, mergedOrders: 0 };
  }

  const productIds = [...new Set(guestOrders.flatMap((order) => order.items.map((item) => item.productId)))];

  const result = await prisma.$transaction(async (tx) => {
    const productPrices = productIds.length
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, price: true },
        })
      : [];

    const priceMap = new Map(productPrices.map((product) => [product.id, product.price]));
    let migratedOrders = 0;
    let mergedOrders = 0;

    for (const guestOrder of guestOrders) {
      const submittedOrder = await tx.order.findFirst({
        where: {
          procurementId: guestOrder.procurementId,
          userId,
          status: "SUBMITTED",
        },
        select: { id: true },
      });

      if (submittedOrder) {
        await tx.orderItem.deleteMany({ where: { orderId: guestOrder.id } });
        await tx.order.delete({ where: { id: guestOrder.id } });
        continue;
      }

      const userDraft = await tx.order.findFirst({
        where: {
          procurementId: guestOrder.procurementId,
          userId,
          status: "DRAFT",
        },
        include: { items: true },
      });

      if (!userDraft) {
        await tx.order.update({
          where: { id: guestOrder.id },
          data: { userId, guestId: null },
        });
        migratedOrders += 1;
        continue;
      }

      const itemsByProductId = new Map(
        userDraft.items.map((item) => [item.productId, item])
      );

      for (const guestItem of guestOrder.items) {
        const currentPrice = priceMap.get(guestItem.productId) ?? guestItem.price;
        const existingItem = itemsByProductId.get(guestItem.productId);

        if (existingItem) {
          const updatedItem = await tx.orderItem.update({
            where: { id: existingItem.id },
            data: {
              qty: existingItem.qty + guestItem.qty,
              price: currentPrice,
            },
          });
          itemsByProductId.set(guestItem.productId, updatedItem);
          continue;
        }

        const createdItem = await tx.orderItem.create({
          data: {
            orderId: userDraft.id,
            productId: guestItem.productId,
            qty: guestItem.qty,
            price: currentPrice,
          },
        });
        itemsByProductId.set(guestItem.productId, createdItem);
      }

      await tx.orderItem.deleteMany({ where: { orderId: guestOrder.id } });
      await tx.order.delete({ where: { id: guestOrder.id } });
      mergedOrders += 1;
    }

    return { migratedOrders, mergedOrders };
  });

  await clearGuestId();
  return result;
}
