"use server";

import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { str } from "@/lib/formUtils";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { loginSchema } from "@/lib/validation";
import { isLimited, resetRateLimit } from "@/lib/rateLimit";
import { firstZodError } from "@/lib/zodError";
import { mergeGuestDraftOrdersIntoUser } from "@/lib/guestCart";
import { logger } from "@/lib/logger";

async function writeAudit(action, actorLabel, entityId, actorType, meta) {
  try {
    await prisma.auditLog.create({
      data: { actorType, actorLabel, action, entityType: "USER", entityId, meta: meta ?? undefined },
    });
  } catch (err) {
    logger.error({ err, action }, "login audit write failed");
    // never break login UX on audit failure
  }
}

export async function login(_prev, fd) {
  const rawEmail = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const next = str(fd, "next") || "";

  const parse = loginSchema.safeParse({ email: rawEmail, password });
  if (!parse.success) {
    return { error: firstZodError(parse.error) };
  }
  const { email } = parse.data;

  // Rate limit: 5 attempts per (IP + email) in 5 min
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const rateLimitKey = `login:${ip}:${email}`;
  if (await isLimited(rateLimitKey)) {
    return { error: "Слишком много попыток. Попробуйте через 5 минут." };
  }

  // Constant-time-ish path: always run bcrypt compare against either the
  // real hash or a dummy of the same cost, so attackers can't distinguish
  // "user not found" from "wrong password" via response timing.
  const DUMMY_HASH =
    "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.X2kKqgqFpCIGW0vM7mPj.VxqK7iG";

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    await writeAudit("LOGIN_FAILED", email, user?.id ?? email, "PUBLIC", { ip });
    return { error: "Неверный email или пароль." };
  }

  await resetRateLimit(rateLimitKey);
  const actorType = user.role === "ADMIN" || user.role === "OPERATOR" ? "ADMIN" : "PUBLIC";
  await writeAudit("LOGIN_SUCCESS", email, user.id, actorType, null);

  await mergeGuestDraftOrdersIntoUser(user.id);

  await setSessionCookie({
    sub: user.id,
    role: user.role,
    email: user.email,
    fullName: user.fullName,
    settlementId: user.settlementId ?? undefined,
    pickupPointId: user.pickupPointId ?? undefined,
    tv: user.tokenVersion,
  });

  revalidatePath("/", "layout");

  if (next && next.startsWith("/") && next !== "/") {
    redirect(next);
  }
  if (user.role === "ADMIN" || user.role === "OPERATOR") {
    redirect("/admin/dashboard");
  }
  redirect("/my/procurements");
}
