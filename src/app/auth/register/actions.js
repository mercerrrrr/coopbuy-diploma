"use server";

import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { str } from "@/lib/formUtils";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { registerSchema } from "@/lib/validation";
import { isLimited } from "@/lib/rateLimit";
import { firstZodError } from "@/lib/zodError";
import { mergeGuestDraftOrdersIntoUser } from "@/lib/guestCart";

export async function register(_prev, fd) {
  const rawEmail = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const fullName = str(fd, "fullName");
  const phone = str(fd, "phone") || undefined;
  const settlementId = str(fd, "settlementId");
  const next = str(fd, "next") || null;

  // Rate limit: 5 registrations per IP in 5 min
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  if (isLimited(`register:${ip}:${rawEmail}`)) {
    return { error: "Слишком много попыток. Попробуйте через 5 минут." };
  }

  const parse = registerSchema.safeParse({ email: rawEmail, password, fullName, settlementId, phone });
  if (!parse.success) {
    return { error: firstZodError(parse.error) };
  }

  // Check email not taken
  const existing = await prisma.user.findUnique({ where: { email: rawEmail } });
  if (existing) return { error: "Этот email уже зарегистрирован." };

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: rawEmail,
      passwordHash,
      fullName,
      phone: phone || null,
      role: "RESIDENT",
      settlementId,
    },
  });

  await mergeGuestDraftOrdersIntoUser(user.id);

  await setSessionCookie({
    sub: user.id,
    role: user.role,
    email: user.email,
    fullName: user.fullName,
    settlementId: user.settlementId ?? undefined,
    pickupPointId: undefined,
  });

  revalidatePath("/", "layout");
  redirect(next && next.startsWith("/") ? next : "/my/procurements");
}
