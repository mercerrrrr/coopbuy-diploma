import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockPrisma } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockPrisma = {
    procurement: {
      findUnique: vi.fn(),
    },
  };

  return { mockGetSession, mockPrisma };
});

vi.mock("@/lib/auth", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import {
  getResidentProcurementAccess,
  requireAccessibleProcurement,
} from "@/lib/guards";

describe("requireAccessibleProcurement()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("разрешает ADMIN доступ к любой закупке", async () => {
    mockGetSession.mockResolvedValue({ role: "ADMIN", pickupPointId: "pp-1" });
    mockPrisma.procurement.findUnique.mockResolvedValue({ id: "proc-1", pickupPointId: "pp-2" });

    const { session, procurement } = await requireAccessibleProcurement("proc-1", {
      select: { id: true },
    });

    expect(session.role).toBe("ADMIN");
    expect(procurement.id).toBe("proc-1");
    expect(mockPrisma.procurement.findUnique).toHaveBeenCalledWith({
      where: { id: "proc-1" },
      select: { id: true, pickupPointId: true },
    });
  });

  it("разрешает OPERATOR доступ только к своей точке выдачи", async () => {
    mockGetSession.mockResolvedValue({ role: "OPERATOR", pickupPointId: "pp-1" });
    mockPrisma.procurement.findUnique.mockResolvedValue({ id: "proc-1", pickupPointId: "pp-1" });

    const { procurement } = await requireAccessibleProcurement("proc-1");

    expect(procurement.id).toBe("proc-1");
  });

  it("запрещает OPERATOR доступ к чужой точке выдачи", async () => {
    mockGetSession.mockResolvedValue({ role: "OPERATOR", pickupPointId: "pp-1" });
    mockPrisma.procurement.findUnique.mockResolvedValue({ id: "proc-1", pickupPointId: "pp-2" });

    await expect(requireAccessibleProcurement("proc-1")).rejects.toThrow("Нет доступа.");
  });

  it("возвращает null procurement, если закупка не найдена", async () => {
    mockGetSession.mockResolvedValue({ role: "ADMIN" });
    mockPrisma.procurement.findUnique.mockResolvedValue(null);

    const { procurement } = await requireAccessibleProcurement("missing");

    expect(procurement).toBeNull();
  });
});

describe("getResidentProcurementAccess()", () => {
  const procurement = {
    settlementId: "settlement-1",
    status: "OPEN",
  };

  it("разрешает участие жителю из того же населённого пункта", () => {
    const access = getResidentProcurementAccess({
      session: { role: "RESIDENT", settlementId: "settlement-1" },
      procurement,
      procurementState: { isActive: true, closedBecauseMinNotReached: false },
    });

    expect(access).toEqual({ status: "allowed", message: null });
  });

  it("требует вход в систему для участия", () => {
    const access = getResidentProcurementAccess({
      session: null,
      procurement,
      procurementState: { isActive: true, closedBecauseMinNotReached: false },
    });

    expect(access.status).toBe("login_required");
  });

  it("запрещает участие пользователю не с ролью RESIDENT", () => {
    const access = getResidentProcurementAccess({
      session: { role: "OPERATOR", settlementId: "settlement-1" },
      procurement,
      procurementState: { isActive: true, closedBecauseMinNotReached: false },
    });

    expect(access.status).toBe("wrong_role");
  });

  it("запрещает участие жителю из другого населённого пункта", () => {
    const access = getResidentProcurementAccess({
      session: { role: "RESIDENT", settlementId: "settlement-2" },
      procurement,
      procurementState: { isActive: true, closedBecauseMinNotReached: false },
    });

    expect(access.status).toBe("wrong_settlement");
  });

  it("возвращает отдельный статус, если минимальная сумма не достигнута", () => {
    const access = getResidentProcurementAccess({
      session: { role: "RESIDENT", settlementId: "settlement-1" },
      procurement,
      procurementState: { isActive: false, closedBecauseMinNotReached: true },
    });

    expect(access.status).toBe("minimum_not_reached");
  });
});
