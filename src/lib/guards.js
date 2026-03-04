import { getSession } from "@/lib/auth";

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
