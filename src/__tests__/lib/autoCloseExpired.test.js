import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    procurement: { updateMany: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";

describe("autoCloseExpiredProcurements()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.procurement.updateMany.mockResolvedValue({ count: 0 });
  });

  it("calls updateMany with correct filter (status OPEN, deadlineAt lte now)", async () => {
    const now = new Date("2026-03-01T12:00:00Z");
    mockPrisma.procurement.updateMany.mockResolvedValue({ count: 2 });

    const result = await autoCloseExpiredProcurements(mockPrisma, now);

    expect(mockPrisma.procurement.updateMany).toHaveBeenCalledWith({
      where: { status: "OPEN", deadlineAt: { lte: now } },
      data: { status: "CLOSED" },
    });
    expect(result).toBe(2);
  });

  it("returns 0 when no procurements to close", async () => {
    mockPrisma.procurement.updateMany.mockResolvedValue({ count: 0 });

    const result = await autoCloseExpiredProcurements(mockPrisma, new Date());

    expect(result).toBe(0);
  });

  it("uses current date by default (no now param)", async () => {
    mockPrisma.procurement.updateMany.mockResolvedValue({ count: 0 });
    const before = new Date();

    await autoCloseExpiredProcurements(mockPrisma);

    const after = new Date();
    const callArg = mockPrisma.procurement.updateMany.mock.calls[0][0];
    const usedDate = callArg.where.deadlineAt.lte;
    expect(usedDate).toBeInstanceOf(Date);
    expect(usedDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(usedDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
