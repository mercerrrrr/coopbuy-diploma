import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { markNotificationRead, markAllNotificationsRead } from "./actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { Bell } from "lucide-react";

const PAGE_SIZE = 20;

const TYPE_ICONS = {
  PROCUREMENT_CREATED: "🛒",
  PROCUREMENT_CLOSED: "🔒",
  PICKUP_WINDOW_UPDATED: "📅",
  ORDER_SUBMITTED: "✅",
  PAYMENT_STATUS_CHANGED: "💳",
  ORDER_ISSUED: "📦",
};

export default async function MyNotificationsPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/my/notifications");

  const userId = String(session.sub);
  const sp = await searchParams;
  const onlyUnread = sp?.filter === "unread";
  const page = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);

  const where = {
    userId,
    ...(onlyUnread ? { readAt: null } : {}),
  };

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  const baseUrl = "/my/notifications";
  const filterQuery = onlyUnread ? { filter: "unread" } : {};

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Уведомления</h1>
        {unreadCount > 0 && (
          <p className="text-sm text-zinc-500 mt-0.5">{unreadCount} непрочитанных</p>
        )}
      </div>

      {/* Filter + mark all */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          <Link
            href="/my/notifications"
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              !onlyUnread
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50",
            ].join(" ")}
          >
            Все
          </Link>
          <Link
            href="/my/notifications?filter=unread"
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              onlyUnread
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50",
            ].join(" ")}
          >
            Непрочитанные
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-4.5 h-4.5 px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
              Отметить все прочитанными
            </button>
          </form>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<Bell size={36} />}
            title={onlyUnread ? "Нет непрочитанных" : "Уведомлений пока нет"}
            description={
              onlyUnread
                ? "Все уведомления прочитаны"
                : "Здесь появятся уведомления о закупках и заявках"
            }
          />
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={[
              "rounded-2xl border bg-white p-4 shadow-sm flex gap-3 items-start transition-colors",
              !n.readAt ? "border-indigo-200 bg-indigo-50/30" : "border-zinc-200",
            ].join(" ")}
          >
            <span className="text-xl shrink-0 mt-0.5 select-none">
              {TYPE_ICONS[n.type] ?? "🔔"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="font-semibold text-sm text-zinc-900">
                  {n.title}
                  {!n.readAt && (
                    <span className="ml-2 inline-block w-2 h-2 rounded-full bg-indigo-500 align-middle" />
                  )}
                </div>
                <div className="text-xs text-zinc-400 shrink-0">
                  {new Date(n.createdAt).toLocaleString("ru-RU")}
                </div>
              </div>
              <p className="text-sm text-zinc-600 mt-0.5 leading-relaxed">{n.body}</p>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {n.linkUrl && (
                  <Link
                    href={n.linkUrl}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Перейти →
                  </Link>
                )}
                {!n.readAt && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <button className="text-xs text-zinc-400 hover:text-zinc-700 underline transition-colors">
                      Прочитано
                    </button>
                  </form>
                )}
                {n.readAt && (
                  <span className="text-xs text-zinc-400">
                    Прочитано {new Date(n.readAt).toLocaleString("ru-RU")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} baseUrl={baseUrl} query={filterQuery} />
    </main>
  );
}
