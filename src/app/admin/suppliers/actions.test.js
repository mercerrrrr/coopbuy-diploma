import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAssertAdmin, mockAssertOperatorOrAdmin, mockPrisma, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockAssertAdmin: vi.fn(),
    mockAssertOperatorOrAdmin: vi.fn(),
    mockPrisma: {
      supplier: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
      supplierDeliveryZone: { upsert: vi.fn(), delete: vi.fn() },
      product: { create: vi.fn(), delete: vi.fn() },
    },
    mockRevalidatePath: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/guards", () => ({
  assertAdmin: mockAssertAdmin,
  assertOperatorOrAdmin: mockAssertOperatorOrAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  createSupplier,
  toggleSupplierActive,
  deleteSupplier,
  addDeliveryZone,
  deleteDeliveryZone,
  createProduct,
  deleteProduct,
} from "./actions";

function formData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const adminSession = { email: "admin@local.test", role: "ADMIN", sub: "u-admin" };
const operatorSession = { email: "op@local.test", role: "OPERATOR", sub: "u-op", pickupPointId: "pp-1" };

describe("supplier CRUD — ADMIN only", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createSupplier — admin допускается", async () => {
    mockAssertAdmin.mockResolvedValue(adminSession);
    mockPrisma.supplier.create.mockResolvedValue({});

    const result = await createSupplier(null, formData({ name: "Test", minOrderSum: "0" }));
    expect(result.ok).toBe(true);
    expect(mockAssertAdmin).toHaveBeenCalled();
  });

  it("createSupplier — operator блокируется assertAdmin()", async () => {
    mockAssertAdmin.mockRejectedValue(new Error("Нет доступа."));

    await expect(createSupplier(null, formData({ name: "Test", minOrderSum: "0" }))).rejects.toThrow(
      "Нет доступа."
    );
  });

  it("deleteSupplier — operator блокируется assertAdmin()", async () => {
    mockAssertAdmin.mockRejectedValue(new Error("Нет доступа."));

    await expect(deleteSupplier(null, formData({ id: "s-1" }))).rejects.toThrow("Нет доступа.");
    expect(mockPrisma.supplier.delete).not.toHaveBeenCalled();
  });

  it("toggleSupplierActive — operator блокируется assertAdmin()", async () => {
    mockAssertAdmin.mockRejectedValue(new Error("Нет доступа."));

    await expect(toggleSupplierActive(null, formData({ id: "s-1" }))).rejects.toThrow("Нет доступа.");
    expect(mockPrisma.supplier.findUnique).not.toHaveBeenCalled();
  });

  it("addDeliveryZone — operator блокируется assertAdmin()", async () => {
    mockAssertAdmin.mockRejectedValue(new Error("Нет доступа."));

    await expect(
      addDeliveryZone(null, formData({ supplierId: "s-1", settlementId: "set-1" }))
    ).rejects.toThrow("Нет доступа.");
  });

  it("deleteDeliveryZone — operator блокируется assertAdmin()", async () => {
    mockAssertAdmin.mockRejectedValue(new Error("Нет доступа."));

    await expect(deleteDeliveryZone(null, formData({ id: "z-1" }))).rejects.toThrow("Нет доступа.");
  });
});

describe("product CRUD — operator допускается", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createProduct — operator допускается через assertOperatorOrAdmin()", async () => {
    mockAssertOperatorOrAdmin.mockResolvedValue(operatorSession);
    mockPrisma.product.create.mockResolvedValue({});

    const result = await createProduct(
      null,
      formData({
        supplierId: "s-1",
        name: "Молоко",
        categoryId: "cat-1",
        unitId: "unit-1",
        price: "100",
      })
    );
    expect(result.ok).toBe(true);
    expect(mockAssertOperatorOrAdmin).toHaveBeenCalled();
  });

  it("deleteProduct — operator допускается через assertOperatorOrAdmin()", async () => {
    mockAssertOperatorOrAdmin.mockResolvedValue(operatorSession);
    mockPrisma.product.delete.mockResolvedValue({});

    const result = await deleteProduct(null, formData({ id: "p-1" }));
    expect(result.ok).toBe(true);
  });
});
