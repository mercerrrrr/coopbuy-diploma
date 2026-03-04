import { prisma } from "@/lib/db";

/**
 * Create a single in-app notification for a user.
 */
export async function createNotification({ userId, type, title, body, linkUrl }) {
  await prisma.notification.create({
    data: { userId, type, title, body, linkUrl: linkUrl ?? null },
  });
}

/**
 * Create notifications for multiple users at once (createMany).
 */
export async function createNotificationsMany(userIds, { type, title, body, linkUrl }) {
  if (!userIds || userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      linkUrl: linkUrl ?? null,
    })),
  });
}
