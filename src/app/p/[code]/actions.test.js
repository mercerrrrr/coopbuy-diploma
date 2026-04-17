import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateNotification,
  mockFirstZodError,
  mockGetResidentProcurementAccessById,
  mockPrisma,
  mockRecalcDeliveryShares,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockFirstZodError: vi.fn((error) => error.issues?.[0]?.message ?? "validation error"),
  mockGetResidentProcurementAccessById: vi.fn(),
  mockPrisma: {
    product: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    procurement: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRecalcDeliveryShares: vi.fn(),
  mockRedirect: vi.fn((url) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/guards", () => ({
  getResidentProcurementAccessById: mockGetResidentProcurementAccessById,
  canResidentParticipateInProcurement: (access) => access.status === "allowed",
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: mockCreateNotification,
}));

vi.mock("@/lib/deliveryShares", () => ({
  recalcDeliveryShares: mockRecalcDeliveryShares,
}));

vi.mock("@/lib/zodError", () => ({
  firstZodError: mockFirstZodError,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/audit", () => ({
  writeOrderAudit: vi.fn(),
}));

vi.mock("@/lib/yookassa", () => ({
  paymentsApi: { paymentsPost: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/orders", () => ({
  getItemsGoodsTotal: vi.fn(() => 1000),
}));

import { addToCart, submitOrder } from "./actions";

function formData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe("/p/[code] actions access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects addToCart to login banner for anonymous access", async () => {
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: null,
      procurement: { id: "proc-1", supplierId: "sup-1" },
      access: { status: "login_required", message: "Войдите в систему." },
    });

    await expect(
      addToCart(
        formData({
          code: "ABC123",
          procurementId: "proc-1",
          productId: "product-1",
          qty: "1",
        })
      )
    ).rejects.toThrow("REDIRECT:/p/ABC123?");
  });

  it("redirects addToCart for wrong resident role", async () => {
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: { sub: "operator-1" },
      procurement: { id: "proc-1", supplierId: "sup-1" },
      access: { status: "wrong_role", message: "Только жители могут участвовать." },
    });

    await expect(
      addToCart(
        formData({
          code: "ABC123",
          procurementId: "proc-1",
          productId: "product-1",
          qty: "1",
        })
      )
    ).rejects.toThrow("REDIRECT:/p/ABC123?");
  });

  it("redirects addToCart for settlement mismatch", async () => {
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: { sub: "resident-2" },
      procurement: { id: "proc-1", supplierId: "sup-1" },
      access: {
        status: "wrong_settlement",
        message: "Эта закупка доступна только жителям соответствующего населённого пункта.",
      },
    });

    await expect(
      addToCart(
        formData({
          code: "ABC123",
          procurementId: "proc-1",
          productId: "product-1",
          qty: "1",
        })
      )
    ).rejects.toThrow("REDIRECT:/p/ABC123?");
  });

  it("blocks submitOrder for anonymous users", async () => {
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: null,
      procurement: { id: "proc-1" },
      access: { status: "login_required", message: "Необходимо войти в систему." },
    });

    const result = await submitOrder(
      null,
      formData({
        procurementId: "proc-1",
        code: "ABC123",
        participantName: "Иван Иванов",
        participantPhone: "+79001234567",
      })
    );

    expect(result).toEqual({ ok: false, message: "Необходимо войти в систему." });
  });

  it("blocks submitOrder for wrong role", async () => {
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: { sub: "operator-1" },
      procurement: { id: "proc-1" },
      access: { status: "wrong_role", message: "Только жители могут участвовать." },
    });

    const result = await submitOrder(
      null,
      formData({
        procurementId: "proc-1",
        code: "ABC123",
        participantName: "Иван Иванов",
        participantPhone: "+79001234567",
      })
    );

    expect(result).toEqual({ ok: false, message: "Только жители могут участвовать." });
  });

  it("blocks submitOrder for settlement mismatch", async () => {
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: { sub: "resident-2" },
      procurement: { id: "proc-1" },
      access: {
        status: "wrong_settlement",
        message: "Эта закупка доступна только жителям соответствующего населённого пункта.",
      },
    });

    const result = await submitOrder(
      null,
      formData({
        procurementId: "proc-1",
        code: "ABC123",
        participantName: "Иван Иванов",
        participantPhone: "+79001234567",
      })
    );

    expect(result).toEqual({
      ok: false,
      message: "Эта закупка доступна только жителям соответствующего населённого пункта.",
    });
  });
});

describe("submitOrder race on deadline/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResidentProcurementAccessById.mockResolvedValue({
      session: { sub: "user-1", email: "u@local" },
      procurement: { id: "proc-1", status: "OPEN", deadlineAt: new Date(Date.now() + 3_600_000) },
      access: { status: "allowed" },
    });
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      items: [{ qty: 1, price: 100 }],
    });
    // Replay the transaction callback against a tx shim so our production
    // code's inner re-read runs through the test doubles.
    mockPrisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        procurement: { findUnique: mockPrisma.procurement.findUnique },
        order: {
          updateMany: mockPrisma.order.updateMany,
          update: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockImplementation(({ where }) => {
            // pickupCode uniqueness check → not found (code is available)
            if (where.pickupCode) return Promise.resolve(null);
            // grandTotal re-read after recalc
            return Promise.resolve({ grandTotal: 1000 });
          }),
        },
      };
      return cb(tx);
    });
  });

  it("rejects submit when procurement was closed between read and transaction", async () => {
    mockPrisma.procurement.findUnique.mockResolvedValue({
      status: "CLOSED",
      deadlineAt: new Date(Date.now() + 3_600_000),
    });

    const result = await submitOrder(
      null,
      formData({
        procurementId: "proc-1",
        code: "ABC123",
        participantName: "Иван Иванов",
        participantPhone: "+79001234567",
      })
    );

    expect(result).toEqual({
      ok: false,
      message: "Закупка закрыта — заявку оформить нельзя.",
    });
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects submit when deadline expired between read and transaction", async () => {
    mockPrisma.procurement.findUnique.mockResolvedValue({
      status: "OPEN",
      deadlineAt: new Date(Date.now() - 1000),
    });

    const result = await submitOrder(
      null,
      formData({
        procurementId: "proc-1",
        code: "ABC123",
        participantName: "Иван Иванов",
        participantPhone: "+79001234567",
      })
    );

    expect(result).toEqual({
      ok: false,
      message: "Закупка закрыта — заявку оформить нельзя.",
    });
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("allows submit when procurement is still OPEN and in-window", async () => {
    mockPrisma.procurement.findUnique.mockResolvedValue({
      status: "OPEN",
      deadlineAt: new Date(Date.now() + 3_600_000),
    });
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await submitOrder(
      null,
      formData({
        procurementId: "proc-1",
        code: "ABC123",
        participantName: "Иван Иванов",
        participantPhone: "+79001234567",
      })
    );

    expect(result).toEqual({ ok: true, message: "Заявка принята!" });
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "DRAFT" },
      data: expect.objectContaining({ status: "SUBMITTED" }),
    });
    expect(mockRecalcDeliveryShares).toHaveBeenCalledWith("proc-1", expect.anything());
  });
});
