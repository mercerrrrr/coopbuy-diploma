import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PUBLIC_PROCUREMENT_ACCESS_MESSAGES } from "@/lib/constants";
import { getProcurementState } from "@/lib/procurements/state";

// ── Return-pattern guards (for useActionState server actions) ──────────────

export async function requireSessionResult() {
  const session = await getSession();
  if (!session) return { session: null, fail: { ok: false, message: "Войдите в систему." } };
  return { session, fail: null };
}

export async function requireRoleResult(roles) {
  const { session, fail } = await requireSessionResult();
  if (fail) return { session: null, fail };
  if (!roles.includes(session.role))
    return { session: null, fail: { ok: false, message: "Нет доступа." } };
  return { session, fail: null };
}

export async function requireAdminResult() {
  return requireRoleResult(["ADMIN"]);
}

export async function requireOperatorOrAdminResult() {
  return requireRoleResult(["ADMIN", "OPERATOR"]);
}

export async function requireResidentResult() {
  return requireRoleResult(["RESIDENT"]);
}

// ── Route handler guard (returns Response on failure, session on success) ──

/**
 * For use in GET route handlers. Returns { session } on success,
 * or { response } with 401/403 on failure.
 * If OPERATOR, also checks procurement.pickupPointId matches session.pickupPointId.
 */
export async function requireOperatorOrAdminRoute(procurementPickupPointId = null) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    return { session: null, response: new Response("Unauthorized", { status: 401 }) };
  }
  if (
    procurementPickupPointId !== null &&
    session.role === "OPERATOR" &&
    session.pickupPointId !== procurementPickupPointId
  ) {
    return { session: null, response: new Response("Forbidden", { status: 403 }) };
  }
  return { session, response: null };
}

export async function requireAccessibleProcurement(procurementId, query = {}) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    throw new Error("Нет доступа.");
  }

  const prismaQuery = query.select
    ? { ...query, select: { ...query.select, pickupPointId: true } }
    : query;

  const procurement = await prisma.procurement.findUnique({
    where: { id: procurementId },
    ...prismaQuery,
  });

  if (!procurement) {
    return { session, procurement: null };
  }

  if (
    session.role === "OPERATOR" &&
    procurement.pickupPointId !== session.pickupPointId
  ) {
    throw new Error("Нет доступа.");
  }

  return { session, procurement };
}

export function getResidentProcurementAccess({ session, procurement, procurementState }) {
  if (procurementState.closedBecauseMinNotReached) {
    return {
      status: "minimum_not_reached",
      message: PUBLIC_PROCUREMENT_ACCESS_MESSAGES.minimum_not_reached,
    };
  }

  if (!procurementState.isActive) {
    return {
      status: "deadline_closed",
      message:
        procurement.status === "OPEN"
          ? "Дедлайн истёк. Приём заявок завершён."
          : PUBLIC_PROCUREMENT_ACCESS_MESSAGES.deadline_closed,
    };
  }

  if (!session) {
    return {
      status: "login_required",
      message: PUBLIC_PROCUREMENT_ACCESS_MESSAGES.login_required,
    };
  }

  if (session.role !== "RESIDENT") {
    return {
      status: "wrong_role",
      message: PUBLIC_PROCUREMENT_ACCESS_MESSAGES.wrong_role,
    };
  }

  if (!session.settlementId || String(session.settlementId) !== String(procurement.settlementId)) {
    return {
      status: "wrong_settlement",
      message: !session.settlementId
        ? "У вашего аккаунта не указан населённый пункт. Обратитесь к администратору."
        : PUBLIC_PROCUREMENT_ACCESS_MESSAGES.wrong_settlement,
    };
  }

  return { status: "allowed", message: null };
}

export function canResidentParticipateInProcurement(access) {
  return access.status === "allowed";
}

export async function getResidentProcurementAccessById(procurementId, query = {}) {
  const session = await getSession();

  const prismaQuery = query.select
    ? {
        ...query,
        select: {
          ...query.select,
          settlementId: true,
          status: true,
          deadlineAt: true,
          minTotalSum: true,
        },
      }
    : query;

  const procurement = await prisma.procurement.findUnique({
    where: { id: procurementId },
    ...prismaQuery,
  });

  if (!procurement) {
    return {
      session,
      procurement: null,
      procurementState: null,
      access: { status: "not_found", message: "Закупка не найдена." },
    };
  }

  const submittedStats = await prisma.order.aggregate({
    where: { procurementId, status: "SUBMITTED" },
    _sum: { goodsTotal: true },
  });

  const procurementState = getProcurementState(
    procurement,
    submittedStats._sum.goodsTotal ?? 0
  );

  return {
    session,
    procurement,
    procurementState,
    access: getResidentProcurementAccess({ session, procurement, procurementState }),
  };
}

// ── Throw-pattern guards (for plain server actions / route handlers) ────────

export async function assertAuth() {
  const session = await getSession();
  if (!session) throw new Error("Войдите в систему.");
  return session;
}

export async function assertAdmin() {
  const session = await assertAuth();
  if (session.role !== "ADMIN") throw new Error("Нет доступа.");
  return session;
}

export async function assertOperatorOrAdmin() {
  const session = await assertAuth();
  if (session.role !== "ADMIN" && session.role !== "OPERATOR")
    throw new Error("Нет доступа.");
  return session;
}

export async function assertResident() {
  const session = await assertAuth();
  if (session.role !== "RESIDENT") throw new Error("Нет доступа.");
  return session;
}
