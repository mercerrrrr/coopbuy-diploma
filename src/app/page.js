import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          CoopBuy — дипломный проект
        </h1>

        <p className="mt-2 text-sm text-zinc-600">
          MVP: справочники → поставщики/каталог → закупки → ссылка-приглашение → корзина.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/locations"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Админка: Локации
          </Link>

          <Link
            href="/admin/suppliers"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Админка: Поставщики
          </Link>

          <Link
            href="/admin/procurements"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Админка: Закупки
          </Link>
        </div>
      </div>
    </main>
  );
}
