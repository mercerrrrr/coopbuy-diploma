import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookieStore, mockCookies, mockPrisma, mockTx } = vi.hoisted(() => {
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const mockCookies = vi.fn().mockResolvedValue(mockCookieStore);

  const mockTx = {
    product: { findMany: vi.fn() },
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    orderItem: {
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const mockPrisma = {
    order: { findMany: vi.fn() },
    $transaction: vi.fn(async (callback) => callback(mockTx)),
  };

  return { mockCookieStore, mockCookies, mockPrisma, mockTx };
});

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { mergeGuestDraftOrdersIntoUser } from "@/lib/guestCart";

describe("mergeGuestDraftOrdersIntoUser()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.get.mockReturnValue({ value: "guest-1" });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
  });

  it("переносит guest draft на пользователя, если его draft ещё нет", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: "guest-order-1",
        procurementId: "proc-1",
        items: [{ id: "item-1", productId: "product-1", qty: 2, price: 100 }],
      },
    ]);

    mockTx.product.findMany.mockResolvedValue([{ id: "product-1", price: 110 }]);
    mockTx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await mergeGuestDraftOrdersIntoUser("user-1");

    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: "guest-order-1" },
      data: { userId: "user-1", guestId: null },
    });
    expect(mockCookieStore.delete).toHaveBeenCalledWith("cb_guest");
    expect(result).toEqual({ migratedOrders: 1, mergedOrders: 0 });
  });

  it("сливает guest draft с существующим draft пользователя по productId", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: "guest-order-1",
        procurementId: "proc-1",
        items: [
          { id: "item-1", productId: "product-1", qty: 2, price: 100 },
          { id: "item-2", productId: "product-2", qty: 1, price: 60 },
        ],
      },
    ]);

    mockTx.product.findMany.mockResolvedValue([
      { id: "product-1", price: 130 },
      { id: "product-2", price: 70 },
    ]);
    mockTx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-order-1",
        items: [{ id: "user-item-1", productId: "product-1", qty: 3, price: 120 }],
      });
    mockTx.orderItem.update.mockResolvedValue({
      id: "user-item-1",
      productId: "product-1",
      qty: 5,
      price: 130,
    });
    mockTx.orderItem.create.mockResolvedValue({
      id: "user-item-2",
      productId: "product-2",
      qty: 1,
      price: 70,
    });

    const result = await mergeGuestDraftOrdersIntoUser("user-1");

    expect(mockTx.orderItem.update).toHaveBeenCalledWith({
      where: { id: "user-item-1" },
      data: { qty: 5, price: 130 },
    });
    expect(mockTx.orderItem.create).toHaveBeenCalledWith({
      data: {
        orderId: "user-order-1",
        productId: "product-2",
        qty: 1,
        price: 70,
      },
    });
    expect(mockTx.orderItem.deleteMany).toHaveBeenCalledWith({
      where: { orderId: "guest-order-1" },
    });
    expect(mockTx.order.delete).toHaveBeenCalledWith({
      where: { id: "guest-order-1" },
    });
    expect(mockCookieStore.delete).toHaveBeenCalledWith("cb_guest");
    expect(result).toEqual({ migratedOrders: 0, mergedOrders: 1 });
  });
});
