import { describe, expect, it } from "vitest";

import {
  getItemsGoodsTotal,
  getOrderTotals,
  getOrdersGoodsTotal,
  getOrdersGrandTotal,
} from "@/lib/orders";

describe("order totals helpers", () => {
  it("считает сумму товаров по позициям", () => {
    expect(
      getItemsGoodsTotal([
        { qty: 2, price: 100 },
        { qty: 3, price: 40 },
      ])
    ).toBe(320);
  });

  it("подставляет fallback для goodsTotal, deliveryShare и grandTotal", () => {
    expect(
      getOrderTotals({
        items: [
          { qty: 2, price: 100 },
          { qty: 1, price: 50 },
        ],
      })
    ).toEqual({
      goodsTotal: 250,
      deliveryShare: 0,
      grandTotal: 250,
    });
  });

  it("суммирует totals по нескольким заказам", () => {
    const orders = [
      { items: [{ qty: 1, price: 100 }], deliveryShare: 20, grandTotal: 120 },
      { goodsTotal: 300, deliveryShare: 30, grandTotal: 330, items: [] },
    ];

    expect(getOrdersGoodsTotal(orders)).toBe(400);
    expect(getOrdersGrandTotal(orders)).toBe(450);
  });
});
