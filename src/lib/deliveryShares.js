import { prisma } from "@/lib/db";
import { getItemsGoodsTotal } from "@/lib/orders";

/**
 * Recomputes goodsTotal / deliveryShare / grandTotal for every SUBMITTED order
 * in a procurement. Pass an interactive transaction client (`tx`) to make the
 * recalc atomic with surrounding writes; otherwise it runs in its own transaction.
 */
export async function recalcDeliveryShares(procurementId, client = prisma) {
  const procurement = await client.procurement.findUnique({
    where: { id: procurementId },
    select: { deliveryFee: true, deliverySplitMode: true },
  });
  if (!procurement) return;

  const orders = await client.order.findMany({
    where: { procurementId, status: "SUBMITTED" },
    include: { items: true },
  });
  if (orders.length === 0) return;

  const fee = procurement.deliveryFee;
  const mode = procurement.deliverySplitMode;

  const goodsTotals = orders.map((order) => getItemsGoodsTotal(order.items));

  let weights;
  if (mode === "EQUAL") {
    weights = orders.map(() => 1);
  } else if (mode === "PER_ITEM") {
    weights = orders.map((o) => o.items.reduce((s, i) => s + i.qty, 0));
  } else {
    weights = goodsTotals;
  }

  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let shares;
  if (fee === 0 || totalWeight === 0) {
    shares = orders.map(() => 0);
  } else {
    // Largest-remainder method: floor + distribute leftover by biggest fractional part.
    // Tie-break by higher index so legacy "give extra to last order" tests stay green.
    const exact = weights.map((w) => (fee * w) / totalWeight);
    shares = exact.map((s) => Math.floor(s));
    let leftover = fee - shares.reduce((s, v) => s + v, 0);
    if (leftover > 0) {
      const order = exact
        .map((s, i) => ({ i, frac: s - Math.floor(s) }))
        .sort((a, b) => b.frac - a.frac || b.i - a.i);
      for (let k = 0; k < leftover; k++) {
        shares[order[k % order.length].i] += 1;
      }
    }
  }

  // If we have an interactive tx client, run updates sequentially on it.
  // Otherwise wrap in a fresh $transaction for atomicity.
  if (client === prisma) {
    await prisma.$transaction(
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
  } else {
    for (let i = 0; i < orders.length; i++) {
      await client.order.update({
        where: { id: orders[i].id },
        data: {
          goodsTotal: goodsTotals[i],
          deliveryShare: shares[i],
          grandTotal: goodsTotals[i] + shares[i],
        },
      });
    }
  }
}
