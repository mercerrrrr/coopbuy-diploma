"use server";

import { clearSessionCookie, getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function logoutAction() {
  const session = await getSession();

  if (session) {
    try {
      const actorType = session.role === "ADMIN" || session.role === "OPERATOR" ? "ADMIN" : "PUBLIC";
      await prisma.auditLog.create({
        data: {
          actorType,
          actorLabel: session.email,
          action: "LOGOUT",
          entityType: "USER",
          entityId: String(session.sub),
        },
      });
    } catch {
      // never break logout on audit failure
    }
  }

  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/");
}
