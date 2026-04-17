import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetSession, mockRevalidatePath } = vi.hoisted(() => ({
  mockPrisma: {
    product: {
      findFirst: vi.fn(),
      update:    vi.fn(),
      create:    vi.fn(),
    },
    category: {
      upsert:    vi.fn(),
      findFirst: vi.fn(),
    },
    unit: {
      upsert:    vi.fn(),
      findFirst: vi.fn(),
    },
    priceImportBatch: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    priceImportRow: {
      update:    vi.fn(),
      findMany:  vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  mockGetSession: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/db",     () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth",   () => ({ getSession: mockGetSession }));
vi.mock("next/cache",   () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyBatch, undoBatch } from "./actions";

function fd(entries) {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

describe("applyBatch() — snapshot previous values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ role: "ADMIN", email: "admin@local.test" });
    mockPrisma.category.upsert.mockResolvedValue({ id: "cat-1", name: "Хлеб" });
    mockPrisma.unit.upsert.mockResolvedValue({ id: "unit-1", name: "шт" });
  });

  it("сохраняет previousPrice и appliedProductId при обновлении существующего товара", async () => {
    mockPrisma.priceImportBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      supplierId: "sup-1",
      fileName:   "price.csv",
      status:     "DRAFT",
      rows: [
        {
          id:          "row-1",
          rawName:     "Хлеб белый",
          rawCategory: "Хлеб",
          rawUnit:     "шт",
          rawPrice:    "50",
          rawSku:      null,
          rawImageUrl: null,
        },
      ],
    });
    mockPrisma.product.findFirst.mockResolvedValue({
      id: "prod-1", price: 42, isActive: true,
    });
    mockPrisma.product.update.mockResolvedValue({});
    mockPrisma.priceImportRow.update.mockResolvedValue({});
    mockPrisma.priceImportBatch.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await applyBatch(null, fd({ batchId: "batch-1" }));

    expect(res.success).toBe(true);
    expect(res.updated).toBe(1);
    expect(mockPrisma.priceImportRow.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: {
        appliedProductId: "prod-1",
        previousPrice:    42,
        previousActive:   true,
      },
    });
    expect(mockPrisma.priceImportBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data:  expect.objectContaining({ status: "APPLIED", appliedAt: expect.any(Date) }),
    });
  });

  it("сохраняет previousPrice=null и appliedProductId для создаваемого товара", async () => {
    mockPrisma.priceImportBatch.findUnique.mockResolvedValue({
      id: "batch-2",
      supplierId: "sup-1",
      fileName:   "new.csv",
      status:     "DRAFT",
      rows: [{
        id: "row-2", rawName: "Молоко", rawCategory: "Молочное",
        rawUnit: "л", rawPrice: "80", rawSku: null, rawImageUrl: null,
      }],
    });
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: "prod-new" });
    mockPrisma.priceImportRow.update.mockResolvedValue({});
    mockPrisma.priceImportBatch.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    await applyBatch(null, fd({ batchId: "batch-2" }));

    expect(mockPrisma.priceImportRow.update).toHaveBeenCalledWith({
      where: { id: "row-2" },
      data: {
        appliedProductId: "prod-new",
        previousPrice:    null,
        previousActive:   null,
      },
    });
  });
});

describe("undoBatch() — restore previous prices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ role: "ADMIN", email: "admin@local.test" });
    mockPrisma.priceImportBatch.update.mockResolvedValue({});
    mockPrisma.product.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("восстанавливает previousPrice у обновлённых товаров и помечает батч REVERTED", async () => {
    mockPrisma.priceImportBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "APPLIED",
      fileName: "price.csv",
      appliedAt: new Date("2026-04-01"),
      createdAt: new Date("2026-04-01"),
      rows: [
        { id: "r1", appliedProductId: "prod-1", previousPrice: 42, previousActive: true  },
        { id: "r2", appliedProductId: "prod-2", previousPrice: 100, previousActive: false },
      ],
    });
    mockPrisma.priceImportRow.findMany.mockResolvedValue([]); // no conflicts

    const res = await undoBatch(null, fd({ batchId: "batch-1" }));

    expect(res.success).toBe(true);
    expect(res.restored).toBe(2);
    expect(res.deactivated).toBe(0);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data:  { price: 42, isActive: true },
    });
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: "prod-2" },
      data:  { price: 100, isActive: false },
    });
    expect(mockPrisma.priceImportBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data:  expect.objectContaining({ status: "REVERTED", revertedAt: expect.any(Date) }),
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "REVERT_PRICE_LIST" }),
    });
  });

  it("деактивирует товары, созданные этим батчем (previousPrice null)", async () => {
    mockPrisma.priceImportBatch.findUnique.mockResolvedValue({
      id: "batch-2",
      status: "APPLIED",
      fileName: "new.csv",
      appliedAt: new Date("2026-04-01"),
      createdAt: new Date("2026-04-01"),
      rows: [
        { id: "r1", appliedProductId: "prod-new", previousPrice: null, previousActive: null },
      ],
    });
    mockPrisma.priceImportRow.findMany.mockResolvedValue([]);

    const res = await undoBatch(null, fd({ batchId: "batch-2" }));

    expect(res.success).toBe(true);
    expect(res.restored).toBe(0);
    expect(res.deactivated).toBe(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: "prod-new" },
      data:  { isActive: false },
    });
  });

  it("блокирует откат при конфликте: более свежий APPLIED затрагивает те же товары", async () => {
    mockPrisma.priceImportBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "APPLIED",
      fileName: "old.csv",
      appliedAt: new Date("2026-04-01"),
      createdAt: new Date("2026-04-01"),
      rows: [
        { id: "r1", appliedProductId: "prod-1", previousPrice: 42, previousActive: true },
      ],
    });
    mockPrisma.priceImportRow.findMany.mockResolvedValue([
      {
        appliedProductId: "prod-1",
        batch: { id: "batch-2", fileName: "newer.csv" },
      },
    ]);

    const res = await undoBatch(null, fd({ batchId: "batch-1" }));

    expect(res.error).toBeTruthy();
    expect(res.conflicts).toEqual(["newer.csv → product prod-1"]);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.priceImportBatch.update).not.toHaveBeenCalled();
  });

  it("отказывает, если батч не APPLIED", async () => {
    mockPrisma.priceImportBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "DRAFT",
      rows: [],
    });

    const res = await undoBatch(null, fd({ batchId: "batch-1" }));

    expect(res.error).toMatch(/только применённый/i);
  });

  it("блокирует RESIDENT (требуется ADMIN или OPERATOR)", async () => {
    mockGetSession.mockResolvedValue({ role: "RESIDENT", email: "user@local.test" });

    await expect(undoBatch(null, fd({ batchId: "batch-1" }))).rejects.toThrow("Нет доступа.");
    expect(mockPrisma.priceImportBatch.findUnique).not.toHaveBeenCalled();
  });
});
