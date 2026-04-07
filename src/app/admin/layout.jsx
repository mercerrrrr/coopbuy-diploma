import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/logoutAction";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Badge } from "@/components/ui/Badge";
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

  return (
    <div className="flex min-h-[100dvh] bg-transparent">
      <AdminSidebar role={role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[color:var(--cb-line)] bg-[rgba(243,245,242,0.96)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-5">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--cb-text)]">
                Рабочий кабинет
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-sm text-[color:var(--cb-text-soft)]">
                <Link
                  href="/"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line)] bg-white px-3 py-2 hover:bg-[color:var(--cb-bg-soft)]"
                >
                  На главную
                </Link>
                <Badge variant="neutral">{ROLE_LABELS[role] ?? role}</Badge>
                {session?.email && <span className="truncate">{session.email}</span>}
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3.5 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)] active:translate-y-[1px]"
              >
                Выйти
              </button>
            </form>
          </div>
        </header>

        <div className="flex-1 px-2 py-2 md:px-3">{children}</div>
      </div>
    </div>
  );
}
