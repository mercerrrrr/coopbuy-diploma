import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getBaseUrl } from "@/lib/baseUrl";
import { createProcurement, closeProcurement } from "./actions";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { CreateProcurementForm } from "./ClientForms";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ActionButtonForm } from "@/components/ui/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { PageHeader } from "@/components/ui/PageHeader";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";
import { getProcurementState } from "@/lib/procurements/state";

const PAGE_SIZE = 20;

export default async function ProcurementsPage({ searchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.page ?? 1));
  const view = sp?.view === "archive" ? "archive" : "active";
  const baseUrl = await getBaseUrl();
  const now = new Date();

  const session = await getSession();
  await autoCloseExpiredProcurements(prisma);
  const isOperator = session?.role === "OPERATOR";
  const operatorPickupPointId = isOperator ? String(session.pickupPointId ?? "") : null;

  let operatorSettlementId = null;
  if (isOperator && operatorPickupPointId) {
    const pickupPoint = await prisma.pickupPoint.findUnique({
      where: { id: operatorPickupPointId },
      select: { settlementId: true },
    });
    operatorSettlementId = pickupPoint?.settlementId ?? null;
  }

  const viewFilter =
    view === "active"
      ? { status: "OPEN", deadlineAt: { gt: now } }
      : { OR: [{ status: { not: "OPEN" } }, { deadlineAt: { lte: now } }] };

  const procurementWhere =
    isOperator && operatorPickupPointId
      ? { pickupPointId: operatorPickupPointId, ...viewFilter }
      : viewFilter;

  const [suppliers, settlementsRaw, pickupPointsRaw, procurements, totalCount] =
    await Promise.all([
      prisma.supplier.findMany({
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, name: true, minOrderSum: true },
      }),
      prisma.settlement.findMany({
        orderBy: [{ name: "asc" }],
        include: { region: true },
      }),
      prisma.pickupPoint.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: { settlement: { include: { region: true } } },
      }),
      prisma.procurement.findMany({
        orderBy: [{ createdAt: "desc" }],
        where: procurementWhere,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        include: {
          supplier: true,
          settlement: { include: { region: true } },
          pickupPoint: true,
        },
      }),
      prisma.procurement.count({ where: procurementWhere }),
    ]);

  const procurementIds = procurements.map((procurement) => procurement.id);
  const orderStats =
    procurementIds.length > 0
      ? await prisma.order.groupBy({
          by: ["procurementId"],
          where: { status: "SUBMITTED", procurementId: { in: procurementIds } },
          _count: { _all: true },
          _sum: { goodsTotal: true },
        })
      : [];

  const statsMap = new Map(
    orderStats.map((stat) => [
      stat.procurementId,
      { count: stat._count._all, total: stat._sum.goodsTotal ?? 0 },
    ])
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const settlements = settlementsRaw.map((settlement) => ({
    id: settlement.id,
    label: `${settlement.name}${settlement.region.name ? ` · ${settlement.region.name}` : ""}`,
  }));

  const pickupPoints = pickupPointsRaw.map((pickupPoint) => ({
    id: pickupPoint.id,
    settlementId: pickupPoint.settlementId,
    label: `${pickupPoint.name} — ${pickupPoint.settlement.name}${
      pickupPoint.settlement.region.name ? ` · ${pickupPoint.settlement.region.name}` : ""
    }`,
  }));

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Операционный центр / закупки"
        title={isOperator ? "Закупки вашей точки выдачи" : "Управление закупками"}
        description="Создавайте закупки, публикуйте ссылку для жителей и контролируйте статус сбора, оплаты и завершения из одного списка."
        meta={
          <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3">
            <div className="cb-kicker">Сейчас</div>
            <div className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
              {totalCount}
            </div>
            <div className="text-xs text-[color:var(--cb-text-soft)]">
              закупок · {view === "active" ? "активный список" : "архив"}
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { key: "active", label: "Активные" },
          { key: "archive", label: "Архив" },
        ].map((item) => (
          <a
            key={item.key}
            href={`?view=${item.key}&page=1`}
            className={`inline-flex min-h-9 items-center rounded-md border px-3 py-2 text-sm font-medium ${
              view === item.key
                ? "border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] text-white shadow-[var(--cb-shadow-xs)]"
                : "border-[color:var(--cb-line-strong)] bg-white text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--cb-line)] bg-[color:var(--cb-accent-soft)] text-sm font-semibold text-[color:var(--cb-accent-strong)]">
              01
            </span>
            <div>
              <CardTitle>Создать закупку</CardTitle>
              <p className="mt-1 text-sm text-[color:var(--cb-text-soft)]">Форма создания новой закупки.</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <CreateProcurementForm
            action={createProcurement}
            suppliers={suppliers}
            settlements={settlements}
            pickupPoints={pickupPoints}
            operatorPickupPointId={operatorPickupPointId}
            operatorSettlementId={operatorSettlementId}
          />
        </CardBody>
      </Card>

      {totalCount === 0 && (
        <Card>
          <EmptyState
            title="Закупок пока нет"
            description="Создайте первую закупку с помощью формы выше."
          />
        </Card>
      )}

      <div className="space-y-4">
        {procurements.map((procurement) => {
          const stats = statsMap.get(procurement.id) ?? { count: 0, total: 0 };
          const submittedCount = stats.count;
          const submittedTotal = stats.total;
          const progress =
            procurement.minTotalSum > 0
              ? Math.min(100, Math.round((submittedTotal / procurement.minTotalSum) * 100))
              : null;
          const procurementState = getProcurementState(procurement, submittedTotal, now);
          const fullInviteUrl = `${baseUrl}/p/${procurement.inviteCode}`;

          return (
            <Card key={procurement.id}>
              <CardHeader className="items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--cb-text)]">
                      {procurement.title}
                    </h2>
                    <Badge variant={STATUS_VARIANTS[procurement.status] ?? "neutral"}>
                      {STATUS_LABELS[procurement.status] ?? procurement.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--cb-text-soft)]">
                    {procurement.supplier.name} · {procurement.settlement.region.name} ·{" "}
                    {procurement.settlement.name} · {procurement.pickupPoint.name}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                    Дедлайн: {new Date(procurement.deadlineAt).toLocaleString("ru-RU")} · Мин.{" "}
                    {procurement.minTotalSum.toLocaleString("ru-RU")} ₽
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/admin/procurements/${procurement.id}`}
                    className="inline-flex min-h-9 items-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white shadow-[var(--cb-shadow-xs)] hover:bg-[color:var(--cb-accent-strong)]"
                  >
                    Детали
                  </Link>
                  <Link
                    href={`/p/${procurement.inviteCode}`}
                    className="inline-flex min-h-9 items-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                  >
                    Открыть
                  </Link>
                  <ActionButtonForm
                    action={closeProcurement}
                    hiddenFields={{ id: procurement.id }}
                    label="Закрыть"
                    pendingLabel="Закрываем..."
                    confirmText="Закрыть закупку и остановить приём заявок?"
                    size="sm"
                  />
                </div>
              </CardHeader>

              <CardBody className="space-y-4">
                <div className="grid gap-2 md:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3">
                    <div className="cb-kicker">Подтверждено</div>
                    <div className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
                      {submittedCount}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--cb-text-soft)]">заявок</div>
                  </div>

                  <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3">
                    <div className="cb-kicker">Собрано</div>
                    <div className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
                      {submittedTotal.toLocaleString("ru-RU")} ₽
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--cb-text-soft)]">{progress !== null ? `${progress}% от порога` : "Порог не задан"}</div>
                    {progress !== null && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(var(--cb-accent-rgb),0.12)]">
                        <div
                          className="h-1.5 rounded-full bg-[color:var(--cb-accent)] animate-progress"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {procurementState.closedBecauseMinNotReached && (
                  <p className="rounded-[0.95rem] border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-sm text-amber-900">
                    Минимальная сумма не достигнута. Закупка закрыта и перенесена в архив.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3 py-2 text-xs text-[color:var(--cb-text-soft)] break-all">
                    {fullInviteUrl}
                  </code>
                  <CopyLinkButton textToCopy={fullInviteUrl} label="Скопировать" />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Pager page={page} totalPages={totalPages} baseUrl="/admin/procurements" query={{ view }} />

      {totalCount > 0 && totalPages <= 1 && (
        <p className="pb-2 text-center text-xs text-[color:var(--cb-text-faint)]">
          Всего закупок: {totalCount}
        </p>
      )}
    </main>
  );
}
