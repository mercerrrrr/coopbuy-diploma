import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/logoutAction";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isAdminWorkspaceRole, ROLE_LABELS } from "@/lib/constants";

export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=/admin/dashboard");
  }
  if (!isAdminWorkspaceRole(session.role)) {
    redirect("/403");
  }

  const role = session.role;

  let pickupPointLabel = null;
  if (role === "OPERATOR" && session.pickupPointId) {
    const pp = await prisma.pickupPoint.findUnique({
      where: { id: String(session.pickupPointId) },
      select: { name: true, address: true },
    });
    if (pp) {
      pickupPointLabel = `${pp.name}${pp.address ? ` \u00b7 ${pp.address}` : ""}`;
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-transparent">
      <AdminSidebar role={role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[color:var(--cb-line)] bg-[rgba(243,245,242,0.96)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold text-[color:var(--cb-text)]">
                Рабочий кабинет
              </span>
              <Badge variant="neutral">{ROLE_LABELS[role] ?? role}</Badge>
              {session?.email && (
                <span className="hidden truncate text-sm text-[color:var(--cb-text-soft)] sm:inline">
                  {session.email}
                </span>
              )}
              {pickupPointLabel && (
                <span className="hidden truncate text-xs text-[color:var(--cb-text-faint)] sm:inline">
                  {pickupPointLabel}
                </span>
              )}
            </div>

            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Выйти
              </Button>
            </form>
          </div>
        </header>

        <div className="flex-1 px-2 py-2 md:px-4">{children}</div>
      </div>
    </div>
  );
}
