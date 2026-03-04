import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MyNavLinks } from "@/components/MyNavLinks";
import { logoutAction } from "@/lib/logoutAction";

export default async function MyLayout({ children }) {
  const session = await getSession();

  let unreadCount = 0;
  if (session) {
    const userId = String(session.sub);
    unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-zinc-200">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="font-bold text-zinc-900 tracking-tight">
                <span className="text-indigo-600">Coop</span>Buy
              </span>
              {session?.fullName && (
                <>
                  <span className="text-zinc-200 select-none">|</span>
                  <span className="text-sm text-zinc-500 truncate max-w-40">
                    {session.fullName}
                  </span>
                </>
              )}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Выйти
              </button>
            </form>
          </div>

          {/* Tab nav */}
          <div className="pb-2">
            <MyNavLinks unreadCount={unreadCount} />
          </div>
        </div>
      </header>

      {/* Page content */}
      {children}
    </div>
  );
}
