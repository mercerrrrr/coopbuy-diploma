import { Buildings, MapPin, MapPinArea, Snowflake } from "@phosphor-icons/react/ssr";
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
import { PageHeader } from "@/components/ui/PageHeader";

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
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Операционный центр / территории"
        title="Регионы, населённые пункты и точки выдачи"
        description="Поддерживайте территориальную структуру и пункты выдачи, которые используются в закупках, доставке и ролевом доступе."
        meta={
          <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3">
            <div className="cb-kicker">Всего регионов</div>
            <div className="mt-1.5 text-xl font-semibold text-[color:var(--cb-text)]">{regions.length}</div>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Добавить регион</CardTitle>
        </CardHeader>
        <CardBody>
          <CreateRegionForm action={createRegion} />
        </CardBody>
      </Card>

      {regions.length === 0 && (
        <div className="cb-panel-strong rounded-[1.1rem]">
          <EmptyState
            icon={<MapPin size={36} weight="duotone" />}
            title="Регионов пока нет"
            description="Добавьте первый регион, чтобы создать населённые пункты и точки выдачи."
          />
        </div>
      )}

      <div className="space-y-4">
        {regions.map((region) => (
          <Card key={region.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPinArea size={16} className="text-[color:var(--cb-accent)]" />
                <h2 className="text-base font-semibold text-[color:var(--cb-text)]">{region.name}</h2>
                <Badge variant="neutral">{region.settlements.length} населённых пунктов</Badge>
              </div>
              <DeleteRegionButton regionId={region.id} action={deleteRegion} />
            </CardHeader>

            <CardBody className="space-y-3">
              <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] p-3.5">
                <div className="mb-2 text-xs font-medium text-[color:var(--cb-text-faint)]">
                  Добавить населённый пункт
                </div>
                <CreateSettlementForm action={createSettlement} regionId={region.id} />
              </div>

              {region.settlements.length === 0 ? (
                <p className="py-2 text-center text-sm text-[color:var(--cb-text-faint)]">
                  Населённые пункты ещё не добавлены.
                </p>
              ) : (
                <div className="space-y-3">
                  {region.settlements.map((settlement) => (
                    <div
                      key={settlement.id}
                      className="space-y-3 rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Buildings size={14} className="text-[color:var(--cb-text-faint)]" />
                          <span className="font-medium text-[color:var(--cb-text)]">{settlement.name}</span>
                          <Badge variant="neutral">{settlement.pickupPoints.length} точек</Badge>
                        </div>
                        <DeleteSettlementButton
                          settlementId={settlement.id}
                          action={deleteSettlement}
                        />
                      </div>

                      <div className="rounded-xl border border-[color:var(--cb-line)] bg-white p-3">
                        <div className="mb-2 text-xs font-medium text-[color:var(--cb-text-faint)]">
                          Добавить пункт выдачи
                        </div>
                        <CreatePickupPointForm
                          action={createPickupPoint}
                          settlementId={settlement.id}
                        />
                      </div>

                      {settlement.pickupPoints.length > 0 && (
                        <ul className="divide-y divide-[color:var(--cb-line)] rounded-xl border border-[color:var(--cb-line)] bg-white">
                          {settlement.pickupPoints.map((pickupPoint) => (
                            <li
                              key={pickupPoint.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                            >
                              <div>
                                <div className="text-sm font-medium text-[color:var(--cb-text)]">
                                  {pickupPoint.name}
                                </div>
                                {pickupPoint.address && (
                                  <div className="mt-0.5 text-xs text-[color:var(--cb-text-soft)]">
                                    {pickupPoint.address}
                                  </div>
                                )}
                                {pickupPoint.hasFreezer && (
                                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700">
                                    <Snowflake size={12} />
                                    Есть морозильная камера
                                  </span>
                                )}
                              </div>
                              <DeletePickupPointButton
                                pickupPointId={pickupPoint.id}
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
