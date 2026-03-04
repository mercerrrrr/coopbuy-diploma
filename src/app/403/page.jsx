import Link from "next/link";

export const metadata = { title: "Доступ запрещён — CoopBuy" };

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-24 text-center space-y-5">
      <div className="text-7xl font-bold text-zinc-200 select-none">403</div>
      <h1 className="text-xl font-semibold text-zinc-800">Доступ запрещён</h1>
      <p className="text-sm text-zinc-500">
        У вашей учётной записи нет прав для просмотра этой страницы.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href="/"
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          На главную
        </Link>
        <Link
          href="/auth/login"
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors"
        >
          Войти под другим аккаунтом
        </Link>
      </div>
    </main>
  );
}
