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

async function writeAudit(action, actorLabel, entityId, actorType, meta) {
  try {
    await prisma.auditLog.create({
      data: { actorType, actorLabel, action, entityType: "USER", entityId, meta: meta ?? undefined },
    });
  } catch {
    // never break login UX on audit failure
  }
}

export async function login(_prev, fd) {
  const rawEmail = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const next = str(fd, "next") || "/";

  const parse = loginSchema.safeParse({ email: rawEmail, password });
  if (!parse.success) {
    return { error: firstZodError(parse.error) };
  }
  const { email } = parse.data;

  // Rate limit: 5 attempts per (IP + email) in 5 min
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const rateLimitKey = `login:${ip}:${email}`;
  if (isLimited(rateLimitKey)) {
    return { error: "Слишком много попыток. Попробуйте через 5 минут." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await writeAudit("LOGIN_FAILED", email, email, "PUBLIC", { ip });
    return { error: "Неверный email или пароль." };
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    await writeAudit("LOGIN_FAILED", email, user.id, "PUBLIC", { ip });
    return { error: "Неверный email или пароль." };
  }

  resetRateLimit(rateLimitKey);
  const actorType = user.role === "ADMIN" || user.role === "OPERATOR" ? "ADMIN" : "PUBLIC";
  await writeAudit("LOGIN_SUCCESS", email, user.id, actorType, null);

  await setSessionCookie({
    sub: user.id,
    role: user.role,
    email: user.email,
    fullName: user.fullName,
    settlementId: user.settlementId ?? undefined,
    pickupPointId: user.pickupPointId ?? undefined,
  });

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/");
}
