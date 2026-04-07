import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/logoutAction";
import { MyNavLinks } from "@/components/MyNavLinks";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, isResidentRole } from "@/lib/constants";

export default async function MyLayout({ children }) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=/my/procurements");
  }
  if (!isResidentRole(session.role)) {
    redirect("/403");
  }

  let unreadCount = 0;
  const userId = String(session.sub);
  unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });

  return (
    <div className="min-h-[100dvh] bg-transparent">
      <header className="sticky top-0 z-20 border-b border-[color:var(--cb-line)] bg-[rgba(243,245,242,0.96)] backdrop-blur">
        <div className="cb-shell py-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--cb-text)]">
                Личный кабинет
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-[color:var(--cb-text-soft)]">
                <Link
                  href="/"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line)] bg-white px-3 py-2 hover:bg-[color:var(--cb-bg-soft)]"
                >
                  На главную
                </Link>
                <Badge variant="neutral">{ROLE_LABELS[session.role] ?? session.role}</Badge>
                {session?.fullName && <span className="truncate">{session.fullName}</span>}
              </div>
            </div>

            <form action={logoutAction} className="justify-self-start lg:justify-self-end">
              <button
                type="submit"
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3.5 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)] active:translate-y-[1px]"
              >
                Выйти
              </button>
            </form>
          </div>

          <div className="mt-3">
            <MyNavLinks unreadCount={unreadCount} />
          </div>
        </div>
      </header>

      <div className="pb-6 pt-2">{children}</div>
    </div>
  );
}
