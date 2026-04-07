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
    order: { findFirst: vi.fn(), update: vi.fn() },
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
