import { vi, describe, it, expect, beforeEach } from "vitest";

// vi.mock вызывается до импортов (автоматически hoisted Vitest-ом).
// Используем vi.hoisted чтобы переменные мока были доступны и внутри фабрики,
// и снаружи в тестах.
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    procurement: { findUnique: vi.fn() },
    order: { findMany: vi.fn(), update: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { recalcDeliveryShares } from "@/lib/deliveryShares";

// Хелпер: создаёт заказ с items
function order(id, items) {
  return { id, items: items.map(([qty, price]) => ({ qty, price })) };
}

describe("recalcDeliveryShares()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.order.update.mockResolvedValue({});
  });

  // ── EQUAL ───────────────────────────────────────────────────────────────────
  describe("режим EQUAL", () => {
    it("делит сбор поровну между 3 заказами (fee=300 → по 100)", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 300,
        deliverySplitMode: "EQUAL",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("o1", [[1, 100]]),
        order("o2", [[2, 200]]),
        order("o3", [[1, 50]]),
      ]);

      await recalcDeliveryShares("p1");

      const shares = mockPrisma.order.update.mock.calls.map(
        (c) => c[0].data.deliveryShare
      );
      expect(shares).toEqual([100, 100, 100]);
    });

    it("сумма долей равна deliveryFee при нечётном делении (fee=100, 3 заказа)", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 100,
        deliverySplitMode: "EQUAL",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("o1", [[1, 100]]),
        order("o2", [[1, 100]]),
        order("o3", [[1, 100]]),
      ]);

      await recalcDeliveryShares("p1");

      const shares = mockPrisma.order.update.mock.calls.map(
        (c) => c[0].data.deliveryShare
      );
      // 33 + 33 + 34 = 100  (коррекция округления на последний заказ)
      expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
      // Первые два по 33, последний 34
      expect(shares[0]).toBe(33);
      expect(shares[1]).toBe(33);
      expect(shares[2]).toBe(34);
    });
  });

  // ── PROPORTIONAL_SUM ────────────────────────────────────────────────────────
  describe("режим PROPORTIONAL_SUM", () => {
    it("делит пропорционально сумме товаров (25% / 75%)", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 400,
        deliverySplitMode: "PROPORTIONAL_SUM",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("o1", [[1, 100]]), // goods=100 → 25%
        order("o2", [[1, 300]]), // goods=300 → 75%
      ]);

      await recalcDeliveryShares("p1");

      const shares = mockPrisma.order.update.mock.calls.map(
        (c) => c[0].data.deliveryShare
      );
      expect(shares[0]).toBe(100); // 25% от 400
      expect(shares[1]).toBe(300); // 75% от 400
      expect(shares[0] + shares[1]).toBe(400);
    });

    it("grandTotal = goodsTotal + deliveryShare", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 200,
        deliverySplitMode: "PROPORTIONAL_SUM",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("o1", [[2, 100]]), // goods=200
        order("o2", [[1, 200]]), // goods=200
      ]);

      await recalcDeliveryShares("p1");

      const calls = mockPrisma.order.update.mock.calls;
      calls.forEach((c) => {
        const { goodsTotal, deliveryShare, grandTotal } = c[0].data;
        expect(grandTotal).toBe(goodsTotal + deliveryShare);
      });
    });
  });

  // ── PER_ITEM ─────────────────────────────────────────────────────────────────
  describe("режим PER_ITEM", () => {
    it("делит пропорционально количеству товаров (1 шт / 3 шт → 25% / 75%)", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 400,
        deliverySplitMode: "PER_ITEM",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("o1", [[1, 500]]), // 1 штука
        order("o2", [[3, 100]]), // 3 штуки
      ]);

      await recalcDeliveryShares("p1");

      const shares = mockPrisma.order.update.mock.calls.map(
        (c) => c[0].data.deliveryShare
      );
      expect(shares[0]).toBe(100); // 25% от 400
      expect(shares[1]).toBe(300); // 75% от 400
    });

    it("заказ с несколькими позициями: qty суммируется", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 100,
        deliverySplitMode: "PER_ITEM",
      });
      // o1: 2+3=5 шт, o2: 5 шт → поровну
      mockPrisma.order.findMany.mockResolvedValue([
        { id: "o1", items: [{ qty: 2, price: 10 }, { qty: 3, price: 10 }] },
        { id: "o2", items: [{ qty: 5, price: 10 }] },
      ]);

      await recalcDeliveryShares("p1");

      const shares = mockPrisma.order.update.mock.calls.map(
        (c) => c[0].data.deliveryShare
      );
      expect(shares[0]).toBe(50);
      expect(shares[1]).toBe(50);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────
  describe("граничные случаи", () => {
    it("fee=0 → все доли = 0, grandTotal = goodsTotal", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 0,
        deliverySplitMode: "EQUAL",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("o1", [[1, 100]]),
        order("o2", [[2, 200]]),
      ]);

      await recalcDeliveryShares("p1");

      const calls = mockPrisma.order.update.mock.calls;
      calls.forEach((c) => {
        expect(c[0].data.deliveryShare).toBe(0);
        expect(c[0].data.grandTotal).toBe(c[0].data.goodsTotal);
      });
    });

    it("нет заказов → update не вызывается", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 300,
        deliverySplitMode: "EQUAL",
      });
      mockPrisma.order.findMany.mockResolvedValue([]);

      await recalcDeliveryShares("p1");

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it("закупка не найдена → ничего не выполняется", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue(null);

      await recalcDeliveryShares("p1");

      expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it("update вызывается для каждого заказа с правильным id", async () => {
      mockPrisma.procurement.findUnique.mockResolvedValue({
        deliveryFee: 200,
        deliverySplitMode: "EQUAL",
      });
      mockPrisma.order.findMany.mockResolvedValue([
        order("order-aaa", [[1, 100]]),
        order("order-bbb", [[1, 100]]),
      ]);

      await recalcDeliveryShares("p1");

      const ids = mockPrisma.order.update.mock.calls.map((c) => c[0].where.id);
      expect(ids).toContain("order-aaa");
      expect(ids).toContain("order-bbb");
    });
  });
});
