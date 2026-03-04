import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/logoutAction";

const roleLabels = { ADMIN: "Администратор", OPERATOR: "Оператор", RESIDENT: "Участник" };

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              CoopBuy — дипломный проект
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Совместные закупки: справочники → поставщики → закупки → корзина.
            </p>
          </div>

          {/* Auth block */}
          <div className="text-sm text-right">
            {session ? (
              <div className="space-y-1">
                <div className="font-medium">{session.fullName}</div>
                <div className="text-zinc-500">{roleLabels[session.role] ?? session.role}</div>
                <form action={logoutAction}>
                  <button type="submit" className="text-zinc-500 underline hover:text-zinc-900">
                    Выйти
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link
                  href="/auth/login"
                  className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                >
                  Войти
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-xl bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Зарегистрироваться
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {session?.role === "RESIDENT" && (
            <>
              <Link
                href="/my/procurements"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Мои закупки
              </Link>
              <Link
                href="/my/orders"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Мои заявки
              </Link>
            </>
          )}

          {(session?.role === "ADMIN" || session?.role === "OPERATOR") && (
            <Link
              href="/admin/procurements"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Закупки (Админ)
            </Link>
          )}

          {session?.role === "ADMIN" && (
            <>
              <Link
                href="/admin/locations"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Локации
              </Link>
              <Link
                href="/admin/suppliers"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Поставщики
              </Link>
              <Link
                href="/admin/dictionaries"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Справочники
              </Link>
            </>
          )}

          {!session && (
            <p className="text-sm text-zinc-500 mt-1">
              Войдите, чтобы получить доступ к функциям системы.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
