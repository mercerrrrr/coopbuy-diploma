import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { PageHeader } from "@/components/ui/PageHeader";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { getProcurementState } from "@/lib/procurements/state";

const PAGE_SIZE = 10;

function deadlineHint(deadlineAt) {
  const now = new Date();
  const ms = new Date(deadlineAt) - now;
  if (ms <= 0) return { text: "Истёк", cls: "text-rose-700 font-semibold" };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 48) return { text: `через ${hours} ч`, cls: "text-amber-700 font-medium" };
  const days = Math.floor(hours / 24);
  return { text: `через ${days} д`, cls: "text-[color:var(--cb-text-faint)]" };
}

export default async function AdminDashboardPage({ searchParams }) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    redirect("/auth/login");
  }

  await autoCloseExpiredProcurements(prisma);

  const isOperator = session.role === "OPERATOR";
  const operatorPickupPointId = isOperator ? String(session.pickupPointId ?? "") : null;

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, parseInt(sp?.pageSize ?? String(PAGE_SIZE), 10) || PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where =
    isOperator && operatorPickupPointId
      ? { pickupPointId: operatorPickupPointId }
      : undefined;

  const [totalCount, procurements] = await Promise.all([
    prisma.procurement.count({ where }),
    prisma.procurement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        supplier: true,
        settlement: { include: { region: true } },
        pickupPoint: true,
        orders: {
          where: { status: "SUBMITTED" },
          select: {
            id: true,
            goodsTotal: true,
            paymentStatus: true,
            checkin: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Дашборд"
        title={isOperator ? "Закупки точки выдачи" : "Сводка по закупкам"}
        description="Краткий срез по активным закупкам, оплате и выдаче."
        meta={
          <div className="rounded-[0.9rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-left md:text-right">
            <div className="text-xs text-[color:var(--cb-text-soft)]">Страница</div>
            <div className="mt-1 text-xl font-semibold text-[color:var(--cb-text)]">
              {page} / {totalPages}
            </div>
          </div>
        }
        actions={
          <Link
            href="/admin/procurements"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
          >
            Реестр закупок
          </Link>
        }
      />

      {totalCount === 0 && (
        <div className="cb-panel-strong rounded-[1.25rem]">
          <EmptyState
            title="Закупок пока нет"
            description="Создайте первую закупку на экране управления закупками."
            action={
              <Link
                href="/admin/procurements"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--cb-shadow-xs)] hover:bg-[color:var(--cb-accent-strong)]"
              >
                Создать закупку
              </Link>
            }
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {procurements.map((procurement) => {
          const orders = procurement.orders;
          const totalSubmitted = orders.length;
          const submittedTotal = orders.reduce((sum, order) => sum + (order.goodsTotal ?? 0), 0);
          const progress =
            procurement.minTotalSum > 0
              ? Math.min(100, Math.round((submittedTotal / procurement.minTotalSum) * 100))
              : null;
          const paidCount = orders.filter(
            (order) => order.paymentStatus === "PAID" || order.paymentStatus === "PAY_ON_PICKUP"
          ).length;
          const unpaidCount = orders.filter((order) => order.paymentStatus === "UNPAID").length;
          const issuedCount = orders.filter((order) => order.checkin).length;
          const hint = deadlineHint(procurement.deadlineAt);
          const procurementState = getProcurementState(procurement, submittedTotal);

          return (
            <div
              key={procurement.id}
              className="cb-panel-strong flex flex-col overflow-hidden rounded-[1.1rem]"
            >
              <div className="border-b border-[color:var(--cb-line)] px-4 pb-4 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
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
                      {procurement.supplier.name} · {procurement.settlement.region.name},{" "}
                      {procurement.settlement.name} · {procurement.pickupPoint.name}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[color:var(--cb-text-faint)]">Дедлайн:</span>
                      <span className="font-medium text-[color:var(--cb-text)]">
                        {new Date(procurement.deadlineAt).toLocaleDateString("ru-RU")}
                      </span>
                      <span className={hint.cls}>({hint.text})</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 p-3 sm:grid-cols-2">
                <StatCard label="Заявки" value={totalSubmitted} />
                <StatCard label="Собрано" value={`${submittedTotal.toLocaleString("ru-RU")} ₽`} />
                <StatCard variant="success" label="Оплачено" value={paidCount} />
                <StatCard variant="danger" label="Не оплачено" value={unpaidCount} />
                <StatCard
                  variant="info"
                  label="Выдано / всего"
                  value={`${issuedCount} / ${totalSubmitted}`}
                  className="sm:col-span-2"
                />
              </div>

              {progress !== null && (
                <div className="px-3 pb-2">
                  <div className="mb-1 flex justify-between text-xs text-[color:var(--cb-text-faint)]">
                    <span>Прогресс сбора</span>
                    <span className="font-medium text-[color:var(--cb-text-soft)]">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgba(var(--cb-accent-rgb),0.12)]">
                    <div
                      className="h-2 rounded-full bg-[color:var(--cb-accent)] animate-progress"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {procurementState.closedBecauseMinNotReached && (
                <div className="px-3 pb-2 text-sm text-amber-900">
                  Минимальная сумма не достигнута, закупка закрыта.
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-2 border-t border-[color:var(--cb-line)] px-3 py-3">
                <Link
                  href={`/admin/procurements/${procurement.id}`}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white shadow-[var(--cb-shadow-xs)] hover:bg-[color:var(--cb-accent-strong)]"
                >
                  Детали
                </Link>
                <Link
                  href={`/admin/procurements/${procurement.id}/report`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                >
                  Отчёт
                </Link>
                <Link
                  href={`/admin/procurements/${procurement.id}/payments.xlsx`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                >
                  Оплаты (XLSX)
                </Link>
                <Link
                  href={`/admin/procurements/${procurement.id}/export.xlsx`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                >
                  Товары (XLSX)
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <Pager
        page={page}
        totalPages={totalPages}
        baseUrl="/admin/dashboard"
        query={pageSize !== PAGE_SIZE ? { pageSize: String(pageSize) } : {}}
      />
    </main>
  );
}
