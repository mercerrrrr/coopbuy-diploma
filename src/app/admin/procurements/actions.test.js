import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateNotificationsMany,
  mockPrisma,
  mockRevalidatePath,
  mockRequireOperatorOrAdminResult,
  mockWriteProcurementAudit,
} = vi.hoisted(() => ({
  mockCreateNotificationsMany: vi.fn(),
  mockPrisma: {
    pickupPoint: { findUnique: vi.fn() },
    procurement: { findUnique: vi.fn(), create: vi.fn() },
    supplier: { findUnique: vi.fn() },
    supplierDeliveryZone: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
  mockRevalidatePath: vi.fn(),
  mockRequireOperatorOrAdminResult: vi.fn(),
  mockWriteProcurementAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/guards", () => ({
  requireOperatorOrAdminResult: mockRequireOperatorOrAdminResult,
  assertOperatorOrAdmin: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeProcurementAudit: mockWriteProcurementAudit,
}));

vi.mock("@/lib/notifications", () => ({
  createNotificationsMany: mockCreateNotificationsMany,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { createProcurement } from "./actions";

function formData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe("createProcurement()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOperatorOrAdminResult.mockResolvedValue({
      session: {
        role: "OPERATOR",
        email: "operator@local.test",
        pickupPointId: "pickup-own",
      },
      fail: null,
    });
    mockPrisma.pickupPoint.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === "pickup-own") {
        return { settlementId: "settlement-own" };
      }
      return null;
    });
    mockPrisma.supplier.findUnique.mockResolvedValue({ isActive: true });
    mockPrisma.supplierDeliveryZone.findUnique.mockResolvedValue({ isActive: true });
    mockPrisma.procurement.findUnique.mockResolvedValue(null);
    mockPrisma.procurement.create.mockResolvedValue({ id: "procurement-1", inviteCode: "CODE123" });
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  it("для OPERATOR принудительно использует его pickup point и settlement", async () => {
    const result = await createProcurement(
      null,
      formData({
        supplierId: "supplier-1",
        settlementId: "foreign-settlement",
        pickupPointId: "pickup-foreign",
        title: "Тестовая закупка",
        deadlineAt: "2099-01-01T10:00",
        minTotalSum: "1000",
      })
    );

    expect(result).toEqual({
      ok: true,
      message: expect.stringContaining("Закупка создана."),
    });
    expect(mockPrisma.procurement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pickupPointId: "pickup-own",
          settlementId: "settlement-own",
        }),
      })
    );
    expect(mockPrisma.supplierDeliveryZone.findUnique).toHaveBeenCalledWith({
      where: {
        supplierId_settlementId: {
          supplierId: "supplier-1",
          settlementId: "settlement-own",
        },
      },
      select: { isActive: true },
    });
  });
});
