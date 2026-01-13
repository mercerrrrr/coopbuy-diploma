import { prisma } from "@/lib/db";

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

      <div className="mt-6 space-y-4">
        {regions.map((r) => (
          <section key={r.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-medium">{r.name}</h2>

            <div className="mt-3 space-y-3">
              {r.settlements.map((s) => (
                <div key={s.id} className="rounded-xl border bg-zinc-50 p-4">
                  <div className="font-medium">{s.name}</div>

                  <div className="mt-2 text-sm text-zinc-600">Пункты выдачи:</div>
                  <ul className="mt-2 space-y-2">
                    {s.pickupPoints.map((p) => (
                      <li key={p.id} className="rounded-lg bg-white p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{p.name}</div>
                          <span className="text-xs text-zinc-500">
                            {p.hasFreezer ? "есть морозилка" : "без морозилки"}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">{p.address}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
