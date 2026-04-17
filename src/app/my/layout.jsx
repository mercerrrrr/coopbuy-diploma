import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/logoutAction";
import { MyNavLinks } from "@/components/MyNavLinks";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS, isResidentRole } from "@/lib/constants";

export default async function MyLayout({ children }) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=/my/procurements");
  }
  if (!isResidentRole(session.role)) {
    redirect("/403");
  }

  const userId = String(session.sub);

  let settlementLabel = null;
  if (session.settlementId) {
    const settlement = await prisma.settlement.findUnique({
      where: { id: String(session.settlementId) },
      select: { name: true, region: { select: { name: true } } },
    });
    if (settlement) {
      settlementLabel = settlement.region?.name
        ? `${settlement.region.name} \u00b7 ${settlement.name}`
        : settlement.name;
    }
  }

  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });

  return (
    <div className="min-h-[100dvh] bg-transparent">
      <header className="sticky top-0 z-20 border-b border-[color:var(--cb-line)] bg-[rgba(243,245,242,0.96)] backdrop-blur">
        <div className="cb-shell py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold text-[color:var(--cb-text)]">
                Личный кабинет
              </span>
              <Badge variant="neutral">{ROLE_LABELS[session.role] ?? session.role}</Badge>
              {session?.fullName && (
                <span className="hidden truncate text-sm text-[color:var(--cb-text-soft)] sm:inline">
                  {session.fullName}
                </span>
              )}
              {settlementLabel && (
                <span className="hidden truncate text-xs text-[color:var(--cb-text-faint)] sm:inline">
                  {settlementLabel}
                </span>
              )}
            </div>

            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Выйти
              </Button>
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
