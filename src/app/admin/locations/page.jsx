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

import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapPin, Building2, Navigation } from "lucide-react";

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
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1.5">
          <MapPin size={13} />
          <span>Локации</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Локации</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Регионы, населённые пункты и пункты выдачи
        </p>
      </div>

      {/* Add region form */}
      <Card>
        <CardHeader>
          <CardTitle>Добавить регион</CardTitle>
        </CardHeader>
        <CardBody>
          <CreateRegionForm action={createRegion} />
        </CardBody>
      </Card>

      {/* Empty state */}
      {regions.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<MapPin size={36} />}
            title="Регионов пока нет"
            description="Добавьте первый регион с помощью формы выше"
          />
        </div>
      )}

      {/* Regions list */}
      <div className="space-y-4">
        {regions.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Navigation size={15} className="text-indigo-500" />
                <h2 className="text-base font-semibold text-zinc-900">{r.name}</h2>
                <Badge variant="neutral">
                  {r.settlements.length} нас. пунктов
                </Badge>
              </div>
              <DeleteRegionButton regionId={r.id} action={deleteRegion} />
            </CardHeader>

            <CardBody className="space-y-3">
              {/* Add settlement form */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                <div className="text-xs font-medium text-zinc-500 mb-2">
                  Добавить населённый пункт
                </div>
                <CreateSettlementForm action={createSettlement} regionId={r.id} />
              </div>

              {/* Settlements list */}
              {r.settlements.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-2">
                  Населённых пунктов нет
                </p>
              ) : (
                <div className="space-y-3">
                  {r.settlements.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/30 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-zinc-400" />
                          <span className="font-medium text-zinc-800">{s.name}</span>
                          <Badge variant="neutral">
                            {s.pickupPoints.length} пунктов
                          </Badge>
                        </div>
                        <DeleteSettlementButton
                          settlementId={s.id}
                          action={deleteSettlement}
                        />
                      </div>

                      {/* Add pickup point */}
                      <div className="rounded-xl border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-medium text-zinc-500 mb-2">
                          Добавить пункт выдачи
                        </div>
                        <CreatePickupPointForm
                          action={createPickupPoint}
                          settlementId={s.id}
                        />
                      </div>

                      {/* Pickup points list */}
                      {s.pickupPoints.length > 0 && (
                        <ul className="space-y-2">
                          {s.pickupPoints.map((p) => (
                            <li
                              key={p.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
                            >
                              <div>
                                <div className="font-medium text-zinc-800 text-sm">
                                  {p.name}
                                </div>
                                {p.address && (
                                  <div className="text-xs text-zinc-500 mt-0.5">{p.address}</div>
                                )}
                                {p.hasFreezer && (
                                  <span className="text-xs text-sky-600">🧊 есть морозилка</span>
                                )}
                              </div>
                              <DeletePickupPointButton
                                pickupPointId={p.id}
                                action={deletePickupPoint}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
