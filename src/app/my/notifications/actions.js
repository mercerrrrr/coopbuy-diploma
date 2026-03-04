"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(fd) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const userId = String(session.sub);

  const notificationId = fd.get("notificationId");
  if (!notificationId) throw new Error("notificationId missing");

  // Only allow marking own notifications
  await prisma.notification.updateMany({
    where: { id: String(notificationId), userId },
    data: { readAt: new Date() },
  });

  revalidatePath("/my/notifications");
}

export async function markAllNotificationsRead() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const userId = String(session.sub);

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/my/notifications");
}
