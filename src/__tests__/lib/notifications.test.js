import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { createNotification, createNotificationsMany } from "@/lib/notifications";

describe("createNotification()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("вызывает prisma.notification.create с правильными полями", async () => {
    mockPrisma.notification.create.mockResolvedValue({});

    await createNotification({
      userId: "user-1",
      type: "ORDER_SUBMITTED",
      title: "Заявка подтверждена",
      body: "Ваш заказ принят",
      linkUrl: "/my/orders/abc",
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledOnce();
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "ORDER_SUBMITTED",
        title: "Заявка подтверждена",
        body: "Ваш заказ принят",
        linkUrl: "/my/orders/abc",
      },
    });
  });

  it("передаёт null если linkUrl не указан", async () => {
    mockPrisma.notification.create.mockResolvedValue({});

    await createNotification({
      userId: "user-1",
      type: "PROCUREMENT_CREATED",
      title: "Новая закупка",
      body: "Открыта закупка",
      // linkUrl не передаётся
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ linkUrl: null }),
    });
  });

  it("передаёт null если linkUrl явно undefined", async () => {
    mockPrisma.notification.create.mockResolvedValue({});

    await createNotification({
      userId: "user-2",
      type: "PAYMENT_STATUS_CHANGED",
      title: "Статус оплаты",
      body: "Оплата принята",
      linkUrl: undefined,
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ linkUrl: null }),
    });
  });
});

describe("createNotificationsMany()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("вызывает createMany с записью для каждого userId", async () => {
    mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

    await createNotificationsMany(["u1", "u2", "u3"], {
      type: "PROCUREMENT_CREATED",
      title: "Новая закупка",
      body: "Открыта закупка",
      linkUrl: "/p/abc123",
    });

    expect(mockPrisma.notification.createMany).toHaveBeenCalledOnce();
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "u1",
          type: "PROCUREMENT_CREATED",
          title: "Новая закупка",
          body: "Открыта закупка",
          linkUrl: "/p/abc123",
        },
        {
          userId: "u2",
          type: "PROCUREMENT_CREATED",
          title: "Новая закупка",
          body: "Открыта закупка",
          linkUrl: "/p/abc123",
        },
        {
          userId: "u3",
          type: "PROCUREMENT_CREATED",
          title: "Новая закупка",
          body: "Открыта закупка",
          linkUrl: "/p/abc123",
        },
      ],
    });
  });

  it("для пустого массива — createMany не вызывается", async () => {
    await createNotificationsMany([], {
      type: "PROCUREMENT_CREATED",
      title: "T",
      body: "B",
    });

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("для null — createMany не вызывается", async () => {
    await createNotificationsMany(null, {
      type: "PROCUREMENT_CREATED",
      title: "T",
      body: "B",
    });

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("передаёт null для linkUrl если не указан", async () => {
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    await createNotificationsMany(["u1"], {
      type: "ORDER_ISSUED",
      title: "Товар выдан",
      body: "Получите заказ",
      // без linkUrl
    });

    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ linkUrl: null })],
    });
  });
});
