import { prisma } from "@/lib/db";

import {
  createRegion,
  deleteRegion,
  createSettlement,
  deleteSettlement,
  createPickupPoint,
  deletePickupPoint,
} from "./actions";

import {
  CreateRegionForm,
  CreateSettlementForm,
  CreatePickupPointForm,
} from "./ClientForms";

import {
  DeleteRegionButton,
  DeleteSettlementButton,
  DeletePickupPointButton,
} from "./DeleteButtons";

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
        <CreateRegionForm action={createRegion} />
      </section>

      {/* Список регионов */}
      <div className="mt-6 space-y-4">
        {regions.map((r) => (
          <section
            key={r.id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">{r.name}</h2>

              {/* Удаление региона — в Client Component (confirm) */}
              <DeleteRegionButton regionId={r.id} action={deleteRegion} />
            </div>

            {/* Добавить населённый пункт */}
            <div className="mt-4 rounded-xl border bg-zinc-50 p-4">
              <div className="text-sm font-medium">
                Добавить населённый пункт
              </div>
              <CreateSettlementForm action={createSettlement} regionId={r.id} />
            </div>

            {/* Список населённых пунктов */}
            <div className="mt-4 space-y-3">
              {r.settlements.map((s) => (
                <div key={s.id} className="rounded-xl border bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{s.name}</div>

                    {/* Удаление НП — в Client Component (confirm) */}
                    <DeleteSettlementButton
                      settlementId={s.id}
                      action={deleteSettlement}
                    />
                  </div>

                  {/* Добавить пункт выдачи */}
                  <div className="mt-3 rounded-xl border bg-white p-4">
                    <div className="text-sm font-medium">
                      Добавить пункт выдачи
                    </div>
                    <CreatePickupPointForm
                      action={createPickupPoint}
                      settlementId={s.id}
                    />
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
                              <div className="mt-1 text-sm text-zinc-600">
                                {p.address}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs text-zinc-500">
                                {p.hasFreezer ? "есть морозилка" : "без морозилки"}
                              </span>

                              {/* Удаление пункта — в Client Component (confirm) */}
                              <DeletePickupPointButton
                                pickupPointId={p.id}
                                action={deletePickupPoint}
                              />
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
