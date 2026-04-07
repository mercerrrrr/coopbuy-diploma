import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateNotification,
  mockPrisma,
  mockRequireAccessibleProcurement,
  mockRevalidatePath,
  mockWriteOrderAudit,
} = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockRequireAccessibleProcurement: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockWriteOrderAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/guards", () => ({
  requireAccessibleProcurement: mockRequireAccessibleProcurement,
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeOrderAudit: mockWriteOrderAudit,
  writeProcurementAudit: vi.fn(),
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
  assertOrderBelongsToProcurement: vi.fn(),
  assertOrderCanCheckin: vi.fn(),
  assertPickupSessionCanCheckin: vi.fn(),
}));

import { updatePaymentStatus } from "./actions";

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
});
