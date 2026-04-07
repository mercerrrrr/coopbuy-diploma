import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { writeOrderAudit, writeProcurementAudit } from "@/lib/audit";

describe("audit helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("пишет procurement-scoped запись с entityType PROCUREMENT", async () => {
    await writeProcurementAudit({
      actorType: "ADMIN",
      actorLabel: "admin@local.test",
      action: "EXPORT_DOC",
      procurementId: "proc-1",
      orderId: "order-1",
      meta: { type: "report_pdf" },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorType: "ADMIN",
        actorLabel: "admin@local.test",
        action: "EXPORT_DOC",
        entityType: "PROCUREMENT",
        entityId: "proc-1",
        meta: {
          procurementId: "proc-1",
          orderId: "order-1",
          type: "report_pdf",
        },
      },
    });
  });

  it("пишет order-scoped запись с entityType ORDER", async () => {
    await writeOrderAudit({
      actorType: "PUBLIC",
      actorLabel: "user@local.test",
      action: "SUBMIT_ORDER",
      orderId: "order-7",
      procurementId: "proc-9",
      meta: { goodsTotal: 500 },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorType: "PUBLIC",
        actorLabel: "user@local.test",
        action: "SUBMIT_ORDER",
        entityType: "ORDER",
        entityId: "order-7",
        meta: {
          procurementId: "proc-9",
          orderId: "order-7",
          goodsTotal: 500,
        },
      },
    });
  });
});
