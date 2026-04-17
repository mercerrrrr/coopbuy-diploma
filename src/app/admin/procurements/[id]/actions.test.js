import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateNotification,
  mockPrisma,
  mockRequireAccessibleProcurement,
  mockRevalidatePath,
  mockWriteOrderAudit,
  mockWriteProcurementAudit,
  mockGetSession,
  mockAssertOrderBelongsToProcurement,
  mockAssertOrderCanCheckin,
  mockAssertPickupSessionCanCheckin,
} = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    procurement: {
      update: vi.fn(),
    },
    pickupSession: {
      findUnique: vi.fn(),
    },
    pickupCheckin: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockRequireAccessibleProcurement: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockWriteOrderAudit: vi.fn(),
  mockWriteProcurementAudit: vi.fn(),
  mockGetSession: vi.fn(),
  mockAssertOrderBelongsToProcurement: vi.fn(),
  mockAssertOrderCanCheckin: vi.fn(),
  mockAssertPickupSessionCanCheckin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/guards", () => ({
  requireAccessibleProcurement: mockRequireAccessibleProcurement,
}));

vi.mock("@/lib/auth", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/audit", () => ({
  writeOrderAudit: mockWriteOrderAudit,
  writeProcurementAudit: mockWriteProcurementAudit,
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: mockCreateNotification,
}));

vi.mock("@/lib/deliveryShares", () => ({
  recalcDeliveryShares: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("./checkinGuard", () => ({
  assertOrderBelongsToProcurement: mockAssertOrderBelongsToProcurement,
  assertOrderCanCheckin: mockAssertOrderCanCheckin,
  assertPickupSessionCanCheckin: mockAssertPickupSessionCanCheckin,
}));

import { updatePaymentStatus, updateDeliverySettings, checkinOrder } from "./actions";

function formData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe("updatePaymentStatus()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccessibleProcurement.mockResolvedValue({
      session: { email: "admin@local.test", role: "ADMIN" },
      procurement: { id: "procurement-1" },
    });
  });

  it("разрешает переход UNPAID -> PAID", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "UNPAID",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: "user-1" });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-1", paymentStatus: "PAID" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
    expect(mockPrisma.order.update).toHaveBeenCalled();
    expect(mockWriteOrderAudit).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalled();
  });

  it("разрешает переход PAY_ON_PICKUP -> UNPAID", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: null,
      paymentStatus: "PAY_ON_PICKUP",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: null });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-2", paymentStatus: "UNPAID" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
    expect(mockPrisma.order.update).toHaveBeenCalled();
    expect(mockWriteOrderAudit).toHaveBeenCalled();
  });

  it("блокирует переход PAID -> UNPAID и не пишет аудит", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "PAID",
    });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-3", paymentStatus: "UNPAID" })
    );

    expect(result).toEqual({
      ok: false,
      error: "Нельзя изменить статус оплаты с «Оплачено» на «Не оплачено».",
    });
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
    expect(mockWriteOrderAudit).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("разрешает переход PENDING -> PAID (ручное подтверждение)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "PENDING",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: "user-1" });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-4", paymentStatus: "PAID" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
    expect(mockPrisma.order.update).toHaveBeenCalled();
  });

  it("разрешает переход PENDING -> UNPAID (отмена ожидания)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "PENDING",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: "user-1" });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-5", paymentStatus: "UNPAID" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
  });

  it("разрешает переход FAILED -> PAID (ручное подтверждение)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "FAILED",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: "user-1" });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-6", paymentStatus: "PAID" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
  });

  it("разрешает переход FAILED -> PAY_ON_PICKUP", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "FAILED",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: "user-1" });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-7", paymentStatus: "PAY_ON_PICKUP" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
  });
});

describe("updatePaymentStatus() — operator parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccessibleProcurement.mockResolvedValue({
      session: { email: "operator1@local.test", role: "OPERATOR" },
      procurement: { id: "procurement-1" },
    });
  });

  it("оператор может обновить статус оплаты (UNPAID -> PAID)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      procurementId: "procurement-1",
      userId: "user-1",
      paymentStatus: "UNPAID",
    });
    mockPrisma.order.update.mockResolvedValue({ userId: "user-1" });

    const result = await updatePaymentStatus(
      null,
      formData({ orderId: "order-1", paymentStatus: "PAID" })
    );

    expect(result).toEqual({ ok: true, message: "Статус оплаты обновлён." });
    expect(mockPrisma.order.update).toHaveBeenCalled();
  });
});

describe("updateDeliverySettings()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function armProcurement(overrides = {}) {
    mockRequireAccessibleProcurement.mockResolvedValue({
      session: { email: "admin@local.test", role: "ADMIN" },
      procurement: {
        id: "procurement-1",
        status: "OPEN",
        deliveryFee: 0,
        deliverySplitMode: "PROPORTIONAL_SUM",
        ...overrides,
      },
    });
  }

  it("сохраняет настройки и пересчитывает доли когда нет SUBMITTED заявок", async () => {
    armProcurement();
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.procurement.update.mockResolvedValue({});

    const result = await updateDeliverySettings(
      null,
      formData({
        procurementId: "procurement-1",
        deliveryFee: "500",
        deliverySplitMode: "EQUAL",
      })
    );

    expect(result).toEqual({ ok: true, message: "Настройки сохранены, доли пересчитаны." });
    expect(mockPrisma.procurement.update).toHaveBeenCalledWith({
      where: { id: "procurement-1" },
      data: { deliveryFee: 500, deliverySplitMode: "EQUAL" },
    });
  });

  it("разрешает изменение даже при наличии SUBMITTED заявок (доставка отдельно)", async () => {
    armProcurement();
    mockPrisma.procurement.update.mockResolvedValue({});

    const result = await updateDeliverySettings(
      null,
      formData({
        procurementId: "procurement-1",
        deliveryFee: "500",
        deliverySplitMode: "EQUAL",
      })
    );

    expect(result).toEqual({ ok: true, message: "Настройки сохранены, доли пересчитаны." });
    expect(mockPrisma.procurement.update).toHaveBeenCalled();
  });

  it("блокирует изменение если закупка закрыта", async () => {
    armProcurement({ status: "CLOSED" });

    const result = await updateDeliverySettings(
      null,
      formData({
        procurementId: "procurement-1",
        deliveryFee: "500",
        deliverySplitMode: "EQUAL",
      })
    );

    expect(result).toEqual({ error: "Нельзя менять доставку после закрытия закупки." });
    expect(mockPrisma.procurement.update).not.toHaveBeenCalled();
  });

  it("разрешает повторный сабмит без изменений даже при SUBMITTED заявках", async () => {
    armProcurement({ deliveryFee: 500, deliverySplitMode: "EQUAL" });
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.procurement.update.mockResolvedValue({});

    const result = await updateDeliverySettings(
      null,
      formData({
        procurementId: "procurement-1",
        deliveryFee: "500",
        deliverySplitMode: "EQUAL",
      })
    );

    expect(result).toEqual({ ok: true, message: "Настройки сохранены, доли пересчитаны." });
    expect(mockPrisma.order.count).not.toHaveBeenCalled();
    expect(mockPrisma.procurement.update).toHaveBeenCalled();
  });

  it("оператор может обновить настройки доставки", async () => {
    mockRequireAccessibleProcurement.mockResolvedValue({
      session: { email: "operator1@local.test", role: "OPERATOR" },
      procurement: {
        id: "procurement-1",
        status: "OPEN",
        deliveryFee: 0,
        deliverySplitMode: "PROPORTIONAL_SUM",
      },
    });
    mockPrisma.procurement.update.mockResolvedValue({});

    const result = await updateDeliverySettings(
      null,
      formData({
        procurementId: "procurement-1",
        deliveryFee: "300",
        deliverySplitMode: "EQUAL",
      })
    );

    expect(result).toEqual({ ok: true, message: "Настройки сохранены, доли пересчитаны." });
    expect(mockPrisma.procurement.update).toHaveBeenCalled();
  });
});

describe("checkinOrder()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ email: "operator@local.test", sub: "user-op" });
    mockRequireAccessibleProcurement.mockResolvedValue({
      session: { email: "operator@local.test", role: "OPERATOR" },
      procurement: { id: "procurement-1" },
    });
    // $transaction passes a tx object that mirrors prisma surface used inside.
    mockPrisma.$transaction.mockImplementation(async (fn) =>
      fn({
        order: { findUnique: mockPrisma.order.findUnique },
        pickupCheckin: {
          findUnique: mockPrisma.pickupCheckin.findUnique,
          create: mockPrisma.pickupCheckin.create,
        },
      })
    );
  });

  it("выдаёт оплаченную SUBMITTED заявку и уведомляет жителя", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      status: "SUBMITTED",
      paymentStatus: "PAID",
      userId: "user-1",
      participantName: "Иванов",
      procurementId: "procurement-1",
    });
    mockPrisma.pickupSession.findUnique.mockResolvedValue({
      id: "session-1",
      procurementId: "procurement-1",
      status: "ACTIVE",
    });
    mockPrisma.pickupCheckin.findUnique.mockResolvedValue(null);
    mockPrisma.pickupCheckin.create.mockResolvedValue({});

    await checkinOrder(formData({ sessionId: "session-1", orderId: "order-1" }));

    expect(mockPrisma.pickupCheckin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "session-1",
        orderId: "order-1",
        operatorUserId: "user-op",
      }),
    });
    expect(mockWriteProcurementAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CHECKIN_ORDER", orderId: "order-1" })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "ORDER_ISSUED" })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/procurements/procurement-1");
  });

  it("не уведомляет, если у заявки нет userId (гостевой заказ)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      status: "SUBMITTED",
      paymentStatus: "PAY_ON_PICKUP",
      userId: null,
      participantName: "Гость",
      procurementId: "procurement-1",
    });
    mockPrisma.pickupSession.findUnique.mockResolvedValue({
      id: "session-1",
      procurementId: "procurement-1",
      status: "ACTIVE",
    });
    mockPrisma.pickupCheckin.findUnique.mockResolvedValue(null);
    mockPrisma.pickupCheckin.create.mockResolvedValue({});

    await checkinOrder(formData({ sessionId: "session-1", orderId: "order-2" }));

    expect(mockPrisma.pickupCheckin.create).toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("блокирует повторную выдачу одной и той же заявки", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      status: "SUBMITTED",
      paymentStatus: "PAID",
      userId: "user-1",
      participantName: "Иванов",
      procurementId: "procurement-1",
    });
    mockPrisma.pickupSession.findUnique.mockResolvedValue({
      id: "session-1",
      procurementId: "procurement-1",
      status: "ACTIVE",
    });
    mockPrisma.pickupCheckin.findUnique.mockResolvedValue({ id: "checkin-existing" });

    await expect(
      checkinOrder(formData({ sessionId: "session-1", orderId: "order-1" }))
    ).rejects.toThrow("Эта заявка уже выдана.");

    expect(mockPrisma.pickupCheckin.create).not.toHaveBeenCalled();
    expect(mockWriteProcurementAudit).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("требует sessionId и orderId", async () => {
    await expect(checkinOrder(formData({ sessionId: "", orderId: "order-1" }))).rejects.toThrow(
      "Не указана сессия выдачи."
    );
    await expect(checkinOrder(formData({ sessionId: "session-1", orderId: "" }))).rejects.toThrow(
      "Не указана заявка."
    );
  });

  it("пробрасывает ошибку из assertOrderCanCheckin (UNPAID)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      status: "SUBMITTED",
      paymentStatus: "UNPAID",
      userId: "user-1",
      participantName: "Иванов",
      procurementId: "procurement-1",
    });
    mockAssertOrderCanCheckin.mockImplementationOnce(() => {
      throw new Error("Заявка не оплачена.");
    });

    await expect(
      checkinOrder(formData({ sessionId: "session-1", orderId: "order-1" }))
    ).rejects.toThrow("Заявка не оплачена.");

    expect(mockPrisma.pickupCheckin.create).not.toHaveBeenCalled();
  });
});
