import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getBaseUrl } from "@/lib/baseUrl";
import { createProcurement, closeProcurement } from "./actions";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { CreateProcurementForm } from "./ClientForms";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShoppingCart, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_LABELS = {
  DRAFT: "Черновик",
  OPEN: "Открыта",
  CLOSED: "Закрыта",
  CANCELED: "Отменена",
};

const STATUS_VARIANTS = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "neutral",
  CANCELED: "danger",
};

const PAGE_SIZE = 20;

export default async function ProcurementsPage({ searchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.page ?? 1));
  const view = sp?.view === "archive" ? "archive" : "active";
  const baseUrl = await getBaseUrl();
  const now = new Date();

  await autoCloseExpiredProcurements(prisma);

  const session = await getSession();
  const isOperator = session?.role === "OPERATOR";
  const operatorPickupPointId = isOperator ? String(session.pickupPointId ?? "") : null;

  // Derive settlement for OPERATOR
  let operatorSettlementId = null;
  if (isOperator && operatorPickupPointId) {
    const pp = await prisma.pickupPoint.findUnique({
      where: { id: operatorPickupPointId },
      select: { settlementId: true },
    });
    operatorSettlementId = pp?.settlementId ?? null;
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

  // One GROUP BY query replaces N × orders × items fetches
  const procurementIds = procurements.map((p) => p.id);
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
    orderStats.map((s) => [
      s.procurementId,
      { count: s._count._all, total: s._sum.goodsTotal ?? 0 },
    ])
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const settlements = settlementsRaw.map((s) => ({
    id: s.id,
    label: `${s.region.name} • ${s.name}`,
  }));

  const pickupPoints = pickupPointsRaw.map((p) => ({
    id: p.id,
    settlementId: p.settlementId,
    label: `${p.name} — ${p.settlement.region.name} • ${p.settlement.name}`,
  }));

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1.5">
          <ShoppingCart size={13} />
          <span>Закупки</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Закупки</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Создайте закупку → поделитесь ссылкой → участники добавляют товары
        </p>
      </div>

      {/* View switcher */}
      <div className="flex gap-2">
        <a
          href="?view=active&page=1"
          className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            view === "active"
              ? "bg-indigo-600 text-white"
              : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          Активные
        </a>
        <a
          href="?view=archive&page=1"
          className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            view === "archive"
              ? "bg-indigo-600 text-white"
              : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          Архив
        </a>
      </div>

      {/* Create procurement form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-zinc-400" />
            <CardTitle>Создать закупку</CardTitle>
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

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<ShoppingCart size={36} />}
            title="Закупок пока нет"
            description="Создайте первую закупку с помощью формы выше"
          />
        </div>
      )}

      {/* Procurements list */}
      <div className="space-y-4">
        {procurements.map((p) => {
          const inviteUrl = `/p/${p.inviteCode}`;
          const stats = statsMap.get(p.id) ?? { count: 0, total: 0 };
          const submittedCount = stats.count;
          const submittedTotal = stats.total;
          const progress =
            p.minTotalSum > 0
              ? Math.min(100, Math.round((submittedTotal / p.minTotalSum) * 100))
              : null;

          const fullInviteUrl = `${baseUrl}/p/${p.inviteCode}`;
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start gap-3 flex-wrap min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-zinc-900 leading-tight">
                        {p.title}
                      </h2>
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "neutral"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {p.supplier.name} · {p.settlement.region.name} · {p.settlement.name} ·{" "}
                      {p.pickupPoint.name}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      Дедлайн: {new Date(p.deadlineAt).toLocaleString("ru-RU")} · Мин.{" "}
                      {p.minTotalSum.toLocaleString("ru-RU")} ₽
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link
                    href={`/admin/procurements/${p.id}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
                  >
                    Детали
                  </Link>
                  <Link
                    href={inviteUrl}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Открыть
                  </Link>
                  <form action={closeProcurement}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                      Закрыть
                    </button>
                  </form>
                </div>
              </CardHeader>

              <CardBody className="pt-3 pb-4">
                <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                  <span className="text-zinc-500">
                    Заявок (подтв.):{" "}
                    <span className="font-semibold text-zinc-900">{submittedCount}</span>
                  </span>
                  <span className="text-zinc-500">
                    Собрано:{" "}
                    <span className="font-semibold text-zinc-900">
                      {submittedTotal.toLocaleString("ru-RU")} ₽
                    </span>
                    {progress !== null && (
                      <span className="ml-1.5 text-indigo-600 font-medium">({progress}%)</span>
                    )}
                  </span>
                </div>

                {progress !== null && (
                  <div className="h-1.5 w-full max-w-xs rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 animate-progress"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-zinc-100 rounded px-1.5 py-0.5 text-zinc-600 font-mono break-all">
                    {fullInviteUrl}
                  </code>
                  <CopyLinkButton textToCopy={fullInviteUrl} label="Скопировать" />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          {page > 1 ? (
            <a
              href={`?view=${view}&page=${page - 1}`}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <ChevronLeft size={14} />
              Назад
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xl border border-zinc-100 px-3 py-2 text-sm text-zinc-300 cursor-not-allowed">
              <ChevronLeft size={14} />
              Назад
            </span>
          )}

          <span className="text-sm text-zinc-500">
            Страница{" "}
            <span className="font-semibold text-zinc-900">{page}</span>
            {" "}из{" "}
            <span className="font-semibold text-zinc-900">{totalPages}</span>
            <span className="ml-1.5 text-zinc-400 text-xs">({totalCount} закупок)</span>
          </span>

          {page < totalPages ? (
            <a
              href={`?view=${view}&page=${page + 1}`}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Вперёд
              <ChevronRight size={14} />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xl border border-zinc-100 px-3 py-2 text-sm text-zinc-300 cursor-not-allowed">
              Вперёд
              <ChevronRight size={14} />
            </span>
          )}
        </div>
      )}

      {/* Page info when no pagination needed */}
      {totalCount > 0 && totalPages <= 1 && (
        <p className="text-center text-xs text-zinc-400 py-2">
          Всего закупок: {totalCount}
        </p>
      )}
    </main>
  );
}
