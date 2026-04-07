import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  CalendarDots,
  CheckCircle,
  ClockCounterClockwise,
  Package,
  ShoppingCart,
} from "@phosphor-icons/react/ssr";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { markNotificationRead, markAllNotificationsRead } from "./actions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";

const PAGE_SIZE = 20;

const TYPE_ICONS = {
  PROCUREMENT_CREATED: ShoppingCart,
  PROCUREMENT_CLOSED: ClockCounterClockwise,
  PICKUP_WINDOW_UPDATED: CalendarDots,
  ORDER_SUBMITTED: CheckCircle,
  PAYMENT_STATUS_CHANGED: Bell,
  ORDER_ISSUED: Package,
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
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Личный кабинет / уведомления"
        title="История событий по вашим заказам"
        description={
          unreadCount > 0
            ? `${unreadCount} непрочитанных уведомлений. Здесь собраны изменения по закупкам, оплате и выдаче.`
            : "Здесь собраны изменения по закупкам, оплате и выдаче."
        }
        meta={
          <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-left md:text-right">
            <div className="cb-kicker">Показано</div>
            <div className="mt-1.5 text-xl font-semibold text-[color:var(--cb-text)]">
              {notifications.length}
            </div>
            <div className="text-xs text-[color:var(--cb-text-soft)]">сообщений на текущей странице</div>
          </div>
        }
      />

      <div className="cb-panel-strong rounded-[1.2rem] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/my/notifications"
              className={[
                "inline-flex min-h-9 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                !onlyUnread
                  ? "border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] text-white shadow-[var(--cb-shadow-xs)]"
                  : "border border-[color:var(--cb-line-strong)] bg-white text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]",
              ].join(" ")}
            >
              Все
            </Link>
            <Link
              href="/my/notifications?filter=unread"
              className={[
                "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                onlyUnread
                  ? "border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] text-white shadow-[var(--cb-shadow-xs)]"
                  : "border border-[color:var(--cb-line-strong)] bg-white text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]",
              ].join(" ")}
            >
              Непрочитанные
              {unreadCount > 0 && (
                <span className="inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="secondary" size="sm">
                Отметить всё прочитанным
              </Button>
            </form>
          )}
        </div>
      </div>

      {notifications.length === 0 && (
        <div className="cb-panel-strong rounded-[1.1rem]">
          <EmptyState
            icon={<Bell size={36} weight="duotone" />}
            title={onlyUnread ? "Нет непрочитанных" : "Уведомлений пока нет"}
            description={
              onlyUnread
                ? "Все уведомления уже отмечены как прочитанные."
                : "Здесь появятся изменения по закупкам, оплате и выдаче."
            }
          />
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => {
          const NotificationIcon = TYPE_ICONS[notification.type] ?? Bell;

          return (
            <div
              key={notification.id}
              className={[
                "flex items-start gap-4 rounded-[1.2rem] border p-4 shadow-[var(--cb-shadow-xs)] transition-colors",
                !notification.readAt
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-[color:var(--cb-line)] bg-[color:var(--cb-panel-strong)]",
              ].join(" ")}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] border border-[color:var(--cb-line)] bg-white text-[color:var(--cb-accent)]">
                <NotificationIcon size={20} weight="duotone" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-base font-semibold text-[color:var(--cb-text)]">
                    {notification.title}
                    {!notification.readAt && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-[color:var(--cb-text-faint)]">
                    {new Date(notification.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>

                <p className="mt-1 text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
                  {notification.body}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {notification.linkUrl && (
                    <Link
                      href={notification.linkUrl}
                      className="text-xs font-medium text-[color:var(--cb-accent)] transition-colors hover:text-[color:var(--cb-accent-strong)]"
                    >
                      Открыть
                    </Link>
                  )}

                  {!notification.readAt && (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="text-xs text-[color:var(--cb-text-faint)] underline transition-colors hover:text-[color:var(--cb-text)]">
                        Прочитано
                      </button>
                    </form>
                  )}

                  {notification.readAt && (
                    <span className="text-xs text-[color:var(--cb-text-faint)]">
                      Прочитано {new Date(notification.readAt).toLocaleString("ru-RU")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Pager page={page} totalPages={totalPages} baseUrl={baseUrl} query={filterQuery} />
    </main>
  );
}
