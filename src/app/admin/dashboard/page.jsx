import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { LayoutDashboard, Package, ArrowRight, FileSpreadsheet, FileBarChart2 } from "lucide-react";

const PAGE_SIZE = 10;

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

function deadlineHint(deadlineAt) {
  const now = new Date();
  const ms = new Date(deadlineAt) - now;
  if (ms <= 0) return { text: "Истёк", cls: "text-red-600 font-semibold" };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 48) return { text: `через ${hours} ч`, cls: "text-amber-600 font-medium" };
  const days = Math.floor(hours / 24);
  return { text: `через ${days} д`, cls: "text-zinc-400" };
}

export default async function AdminDashboardPage({ searchParams }) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    redirect("/auth/login");
  }

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
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1.5">
            <LayoutDashboard size={13} />
            <span>Дашборд</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {isOperator ? "Мои закупки" : "Все закупки"}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {totalCount} закупок · страница {page} из {totalPages}
          </p>
        </div>
        <Link
          href="/admin/procurements"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors"
        >
          К списку закупок
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<Package size={40} />}
            title="Закупок пока нет"
            description="Создайте первую закупку в разделе «Закупки»"
            action={
              <Link
                href="/admin/procurements"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Создать закупку <ArrowRight size={14} />
              </Link>
            }
          />
        </div>
      )}

      {/* Procurement cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {procurements.map((p) => {
          const orders = p.orders;
          const totalSubmitted = orders.length;
          const submittedTotal = orders.reduce((s, o) => s + (o.goodsTotal ?? 0), 0);
          const progress =
            p.minTotalSum > 0
              ? Math.min(100, Math.round((submittedTotal / p.minTotalSum) * 100))
              : null;
          const paidCount = orders.filter(
            (o) => o.paymentStatus === "PAID" || o.paymentStatus === "PAY_ON_PICKUP"
          ).length;
          const unpaidCount = orders.filter((o) => o.paymentStatus === "UNPAID").length;
          const issuedCount = orders.filter((o) => o.checkin).length;
          const hint = deadlineHint(p.deadlineAt);

          return (
            <div
              key={p.id}
              className="rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-4 border-b border-zinc-100 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h2 className="font-semibold text-zinc-900 leading-snug pr-2">{p.title}</h2>
                  <Badge variant={STATUS_VARIANTS[p.status] ?? "neutral"}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
                <div className="text-xs text-zinc-500 space-y-0.5">
                  <div>{p.supplier.name}</div>
                  <div>{p.settlement.region.name}, {p.settlement.name} · {p.pickupPoint.name}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">Дедлайн:</span>
                  <span className="font-medium text-zinc-700">
                    {new Date(p.deadlineAt).toLocaleDateString("ru-RU")}
                  </span>
                  <span className={hint.cls}>({hint.text})</span>
                </div>
              </div>

              {/* KPI grid */}
              <div className="p-4 grid grid-cols-2 gap-2">
                <StatCard label="Заявки" value={totalSubmitted} />
                <StatCard
                  label="Собрано"
                  value={`${submittedTotal.toLocaleString("ru-RU")} ₽`}
                />
                <StatCard variant="success" label="Оплачено" value={paidCount} />
                <StatCard variant="danger" label="Не оплачено" value={unpaidCount} />
                <StatCard
                  variant="info"
                  label="Выдано / всего"
                  value={`${issuedCount} / ${totalSubmitted}`}
                  className="col-span-2"
                />
              </div>

              {/* Progress bar */}
              {progress !== null && (
                <div className="px-4 pb-2">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Прогресс сбора</span>
                    <span className="font-medium text-zinc-600">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 animate-progress"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto px-4 py-3 border-t border-zinc-100 flex flex-wrap gap-2">
                <Link
                  href={`/admin/procurements/${p.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
                >
                  Детали
                </Link>
                <Link
                  href={`/admin/procurements/${p.id}/report`}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <FileBarChart2 size={12} />
                  Отчёт
                </Link>
                <Link
                  href={`/admin/procurements/${p.id}/payments.xlsx`}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <FileSpreadsheet size={12} />
                  Оплаты XLSX
                </Link>
                <Link
                  href={`/admin/procurements/${p.id}/export.xlsx`}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <FileSpreadsheet size={12} />
                  Экспорт XLSX
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pager */}
      <Pager
        page={page}
        totalPages={totalPages}
        baseUrl="/admin/dashboard"
        query={pageSize !== PAGE_SIZE ? { pageSize: String(pageSize) } : {}}
      />
    </main>
  );
}
