import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockCreateNotificationsMany, mockCreateNotification, mockWriteProcurementAudit, mockWriteOrderAudit, mockRefundsPost, mockGetOrdersGoodsTotal, mockLogger } = vi.hoisted(() => ({
  mockCreateNotificationsMany: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockWriteProcurementAudit: vi.fn(),
  mockWriteOrderAudit: vi.fn(),
  mockRefundsPost: vi.fn(),
  mockGetOrdersGoodsTotal: vi.fn().mockReturnValue(0),
  mockLogger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/notifications", () => ({
  createNotificationsMany: mockCreateNotificationsMany,
  createNotification: mockCreateNotification,
}));

vi.mock("@/lib/audit", () => ({
  writeProcurementAudit: mockWriteProcurementAudit,
  writeOrderAudit: mockWriteOrderAudit,
}));

vi.mock("@/lib/yookassa", () => ({
  refundsApi: { refundsPost: mockRefundsPost },
}));

vi.mock("@/lib/orders", () => ({
  getOrdersGoodsTotal: mockGetOrdersGoodsTotal,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import {
  autoCloseExpiredProcurements,
  notifyProcurementClosed,
  refundPaidOrdersIfMinNotReached,
} from "@/lib/procurements/autoCloseExpired";

function makePrisma() {
  return {
    procurement: {
      findMany: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ minTotalSum: 0 }),
      update: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("autoCloseExpiredProcurements()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when nothing is expired and performs no writes", async () => {
    const prisma = makePrisma();
    prisma.procurement.findMany.mockResolvedValue([]);

    const result = await autoCloseExpiredProcurements(prisma, new Date("2026-03-01T12:00:00Z"));

    expect(result).toBe(0);
    expect(prisma.procurement.update).not.toHaveBeenCalled();
    expect(mockWriteProcurementAudit).not.toHaveBeenCalled();
    expect(mockCreateNotificationsMany).not.toHaveBeenCalled();
  });

  it("closes each expired procurement, writes audit, and notifies SUBMITTED order users", async () => {
    const prisma = makePrisma();
    const now = new Date("2026-03-01T12:00:00Z");
    prisma.procurement.findMany.mockResolvedValue([
      { id: "p1", title: "Картошка" },
      { id: "p2", title: "Морковь" },
    ]);
    prisma.procurement.update.mockResolvedValue({});
    // p1 → two orders with delivery info, p2 → none
    prisma.order.findMany.mockImplementation(({ where }) => {
      if (where.procurementId === "p1") {
        return Promise.resolve([
          { id: "o1", userId: "u1", deliveryShare: 200 },
          { id: "o2", userId: "u2", deliveryShare: 300 },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await autoCloseExpiredProcurements(prisma, now);

    expect(result).toBe(2);
    expect(prisma.procurement.findMany).toHaveBeenCalledWith({
      where: { status: "OPEN", deadlineAt: { lte: now } },
      select: { id: true, title: true },
    });
    expect(prisma.procurement.update).toHaveBeenCalledTimes(2);
    expect(prisma.procurement.update).toHaveBeenNthCalledWith(1, {
      where: { id: "p1" },
      data: { status: "CLOSED" },
    });

    expect(mockWriteProcurementAudit).toHaveBeenCalledTimes(2);
    expect(mockWriteProcurementAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROCUREMENT_AUTO_CLOSED",
        procurementId: "p1",
        actorType: "ADMIN",
      })
    );

    // p1 has 2 orders — individual notifications with delivery share
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "PROCUREMENT_CLOSED",
        linkUrl: "/my/orders/o1",
      })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        type: "PROCUREMENT_CLOSED",
        linkUrl: "/my/orders/o2",
      })
    );
  });
});

describe("refundPaidOrdersIfMinNotReached()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when minTotalSum is 0", async () => {
    const prisma = makePrisma();
    prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 0 });

    const result = await refundPaidOrdersIfMinNotReached(prisma, "p1", "admin@test");

    expect(result).toEqual({ refunded: 0, failed: 0, pendingCancelled: 0 });
    expect(mockRefundsPost).not.toHaveBeenCalled();
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it("returns early when submittedTotal >= minTotalSum", async () => {
    const prisma = makePrisma();
    prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 5000 });
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", paymentStatus: "PAID", yookassaPaymentId: "yk-1", goodsTotal: 6000, userId: "u1", items: [{ qty: 2, price: 3000 }] },
    ]);
    mockGetOrdersGoodsTotal.mockReturnValue(6000);

    const result = await refundPaidOrdersIfMinNotReached(prisma, "p1", "admin@test");

    expect(result).toEqual({ refunded: 0, failed: 0, pendingCancelled: 0 });
    expect(mockRefundsPost).not.toHaveBeenCalled();
  });

  it("refunds PAID orders when min not reached", async () => {
    const prisma = makePrisma();
    prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 10000 });
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", paymentStatus: "PAID", yookassaPaymentId: "yk-1", goodsTotal: 3000, userId: "u1", items: [{ qty: 1, price: 3000 }] },
    ]);
    mockGetOrdersGoodsTotal.mockReturnValue(3000);
    mockRefundsPost.mockResolvedValue({});

    const result = await refundPaidOrdersIfMinNotReached(prisma, "proc1", "admin@test");

    expect(result).toEqual({ refunded: 1, failed: 0, pendingCancelled: 0 });
    expect(mockRefundsPost).toHaveBeenCalledWith("refund-autoclose-o1", {
      payment_id: "yk-1",
      amount: { value: "30.00", currency: "RUB" },
      description: "Автовозврат — минимальная сумма закупки не достигнута",
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { paymentStatus: "REFUNDED", refundedAt: expect.any(Date), refundAmount: 3000 },
    });
    expect(mockWriteOrderAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ONLINE_PAYMENT_REFUNDED",
        orderId: "o1",
        procurementId: "proc1",
        meta: expect.objectContaining({ reason: "min_not_reached" }),
      }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "PAYMENT_STATUS_CHANGED",
        title: "Возврат средств",
      }),
    );
  });

  it("marks PENDING orders as FAILED", async () => {
    const prisma = makePrisma();
    prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 10000 });
    prisma.order.findMany.mockResolvedValue([
      { id: "o2", paymentStatus: "PENDING", yookassaPaymentId: "yk-2", goodsTotal: 2000, userId: "u2", items: [{ qty: 1, price: 2000 }] },
    ]);
    mockGetOrdersGoodsTotal.mockReturnValue(2000);

    const result = await refundPaidOrdersIfMinNotReached(prisma, "proc1", "admin@test");

    expect(result).toEqual({ refunded: 0, failed: 0, pendingCancelled: 1 });
    expect(mockRefundsPost).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "o2" },
      data: { paymentStatus: "FAILED" },
    });
    expect(mockWriteOrderAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ONLINE_PAYMENT_FAILED",
        orderId: "o2",
        meta: expect.objectContaining({ reason: "min_not_reached_procurement_closed" }),
      }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        type: "PAYMENT_STATUS_CHANGED",
        title: "Оплата отменена",
      }),
    );
  });

  it("continues processing when one refund fails", async () => {
    const prisma = makePrisma();
    prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 10000 });
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", paymentStatus: "PAID", yookassaPaymentId: "yk-1", goodsTotal: 1000, userId: "u1", items: [{ qty: 1, price: 1000 }] },
      { id: "o2", paymentStatus: "PAID", yookassaPaymentId: "yk-2", goodsTotal: 2000, userId: "u2", items: [{ qty: 1, price: 2000 }] },
    ]);
    mockGetOrdersGoodsTotal.mockReturnValue(3000);
    mockRefundsPost
      .mockRejectedValueOnce(new Error("YooKassa unavailable"))
      .mockResolvedValueOnce({});

    const result = await refundPaidOrdersIfMinNotReached(prisma, "proc1", "admin@test");

    expect(result).toEqual({ refunded: 1, failed: 1, pendingCancelled: 0 });
    expect(prisma.order.update).toHaveBeenCalledTimes(1);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "o2" } }),
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o1", op: "autoRefund" }),
      "auto-refund failed",
    );
  });

  it("skips PAID orders without yookassaPaymentId", async () => {
    const prisma = makePrisma();
    prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 10000 });
    prisma.order.findMany.mockResolvedValue([
      { id: "o3", paymentStatus: "PAID", yookassaPaymentId: null, goodsTotal: 5000, userId: "u3", items: [{ qty: 1, price: 5000 }] },
    ]);
    mockGetOrdersGoodsTotal.mockReturnValue(5000);

    const result = await refundPaidOrdersIfMinNotReached(prisma, "proc1", "admin@test");

    expect(result).toEqual({ refunded: 0, failed: 0, pendingCancelled: 0 });
    expect(mockRefundsPost).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe("notifyProcurementClosed()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips createNotificationsMany when no SUBMITTED orders", async () => {
    const prisma = makePrisma();
    prisma.order.findMany.mockResolvedValue([]);

    const sent = await notifyProcurementClosed(prisma, "p1", "Закупка");

    expect(sent).toBe(0);
    expect(mockCreateNotificationsMany).not.toHaveBeenCalled();
  });

  it("sends individual notifications with delivery share", async () => {
    const prisma = makePrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", userId: "u1", deliveryShare: 150 },
      { id: "o2", userId: "u2", deliveryShare: 0 },
    ]);

    const sent = await notifyProcurementClosed(prisma, "p1", "Картошка");

    expect(sent).toBe(2);
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    // First notification includes delivery info
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "PROCUREMENT_CLOSED",
        linkUrl: "/my/orders/o1",
      })
    );
    const body1 = mockCreateNotification.mock.calls[0][0].body;
    expect(body1).toContain("150 ₽");
    // Second notification has no delivery info (share = 0)
    const body2 = mockCreateNotification.mock.calls[1][0].body;
    expect(body2).not.toContain("Доставка");
  });
});
