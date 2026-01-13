import { prisma } from "@/lib/db";
import {
  createRegion,
  deleteRegion,
  createSettlement,
  deleteSettlement,
  createPickupPoint,
  deletePickupPoint,
} from "./actions";

export default async function LocationsPage() {
  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
    include: {
      settlements: {
        orderBy: { name: "asc" },
        include: { pickupPoints: true },
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Локации</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Справочники регионов/населённых пунктов/пунктов выдачи (без хардкода).
      </p>

      {/* Создать регион */}
      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-medium">Добавить регион</div>

        <form action={createRegion} className="mt-3 flex flex-wrap gap-3">
          <input
            name="name"
            placeholder="Например: Астраханская область"
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 md:w-105"
          />
          <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Добавить
          </button>
        </form>
      </section>

      {/* Список регионов */}
      <div className="mt-6 space-y-4">
        {regions.map((r) => (
          <section key={r.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">{r.name}</h2>

              <form action={deleteRegion}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                  Удалить регион
                </button>
              </form>
            </div>

            {/* Добавить населённый пункт */}
            <div className="mt-4 rounded-xl border bg-zinc-50 p-4">
              <div className="text-sm font-medium">Добавить населённый пункт</div>

              <form action={createSettlement} className="mt-3 flex flex-wrap gap-3">
                <input type="hidden" name="regionId" value={r.id} />
                <input
                  name="name"
                  placeholder="Например: Новолесное"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 md:w-[320px]"
                />
                <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                  Добавить
                </button>
              </form>
            </div>

            {/* Список населённых пунктов */}
            <div className="mt-4 space-y-3">
              {r.settlements.map((s) => (
                <div key={s.id} className="rounded-xl border bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{s.name}</div>

                    <form action={deleteSettlement}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-100">
                        Удалить НП
                      </button>
                    </form>
                  </div>

                  {/* Добавить пункт выдачи */}
                  <div className="mt-3 rounded-xl border bg-white p-4">
                    <div className="text-sm font-medium">Добавить пункт выдачи</div>

                    <form action={createPickupPoint} className="mt-3 grid gap-3 md:grid-cols-2">
                      <input type="hidden" name="settlementId" value={s.id} />

                      <input
                        name="name"
                        placeholder="Название (например: Пункт выдачи №1)"
                        className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                      />

                      <input
                        name="address"
                        placeholder="Адрес (например: Центральная улица, дом 1)"
                        className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                      />

                      <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input type="checkbox" name="hasFreezer" className="h-4 w-4" />
                        Есть морозилка
                      </label>

                      <div className="md:col-span-2">
                        <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                          Добавить пункт
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Список пунктов выдачи */}
                  <div className="mt-3">
                    <div className="text-sm text-zinc-600">Пункты выдачи:</div>

                    <ul className="mt-2 space-y-2">
                      {s.pickupPoints.map((p) => (
                        <li key={p.id} className="rounded-xl border bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{p.name}</div>
                              <div className="mt-1 text-sm text-zinc-600">{p.address}</div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs text-zinc-500">
                                {p.hasFreezer ? "есть морозилка" : "без морозилки"}
                              </span>

                              <form action={deletePickupPoint}>
                                <input type="hidden" name="id" value={p.id} />
                                <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                                  Удалить
                                </button>
                              </form>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
