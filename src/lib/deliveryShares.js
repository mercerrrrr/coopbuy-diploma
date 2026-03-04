import { prisma } from "@/lib/db";

/**
 * Recomputes goodsTotal / deliveryShare / grandTotal for every SUBMITTED order
 * in a procurement, based on the procurement's current deliveryFee + deliverySplitMode.
 */
export async function recalcDeliveryShares(procurementId) {
  const procurement = await prisma.procurement.findUnique({
    where: { id: procurementId },
    select: { deliveryFee: true, deliverySplitMode: true },
  });
  if (!procurement) return;

  const orders = await prisma.order.findMany({
    where: { procurementId, status: "SUBMITTED" },
    include: { items: true },
  });
  if (orders.length === 0) return;

  const fee = procurement.deliveryFee;
  const mode = procurement.deliverySplitMode;

  const goodsTotals = orders.map((o) =>
    o.items.reduce((s, i) => s + i.qty * i.price, 0)
  );

  let weights;
  if (mode === "EQUAL") {
    weights = orders.map(() => 1);
  } else if (mode === "PER_ITEM") {
    weights = orders.map((o) => o.items.reduce((s, i) => s + i.qty, 0));
  } else {
    // PROPORTIONAL_SUM (default)
    weights = goodsTotals;
  }

  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let shares;
  if (fee === 0 || totalWeight === 0) {
    shares = orders.map(() => 0);
  } else {
    shares = weights.map((w) => Math.round((fee * w) / totalWeight));
    // Correct rounding so sum exactly equals fee
    const diff = fee - shares.reduce((s, v) => s + v, 0);
    shares[shares.length - 1] += diff;
  }

  await Promise.all(
    orders.map((o, i) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          goodsTotal: goodsTotals[i],
          deliveryShare: shares[i],
          grandTotal: goodsTotals[i] + shares[i],
        },
      })
    )
  );
}
