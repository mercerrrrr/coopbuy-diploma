import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAccessibleProcurement } from "@/lib/guards";
import { Badge } from "@/components/ui/Badge";
import { StatCard, Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { PageHeader } from "@/components/ui/PageHeader";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { getProcurementState } from "@/lib/procurements/state";
import { PAYMENT_LABELS, PAYMENT_VARIANTS } from "@/lib/constants";
import { getOrderTotals } from "@/lib/orders";
const ORDERS_PAGE_SIZE = 20;

export default async function ProcurementReportPage({ params, searchParams }) {
  const { id } = await params;

  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    redirect("/auth/login");
  }
  await autoCloseExpiredProcurements(prisma);

  let procurement = null;
  try {
    ({ procurement } = await requireAccessibleProcurement(id, {
      include: {
        supplier: true,
        settlement: { include: { region: true } },
        pickupPoint: true,
      },
    }));
  } catch {
    notFound();
  }
  if (!procurement) notFound();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);
  const filterStatus = sp?.paymentStatus ?? "";
  const search = sp?.search?.trim() ?? "";

  // Build Prisma where for orders
  const ordersWhere = {
    procurementId: id,
    status: "SUBMITTED",
    ...(filterStatus ? { paymentStatus: filterStatus } : {}),
    ...(search
      ? {
          OR: [
            { participantName: { contains: search, mode: "insensitive" } },
            { participantPhone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Aggregations use all orders (unfiltered) for correct KPI
  const allOrders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: {
      items: { include: { product: { include: { category: true, unit: true } } } },
      checkin: true,
    },
    orderBy: { participantName: "asc" },
  });

  // Paginated + filtered orders for the table
  const [ordersTotal, ordersPage] = await Promise.all([
    prisma.order.count({ where: ordersWhere }),
    prisma.order.findMany({
      where: ordersWhere,
      include: { checkin: true },
      orderBy: { participantName: "asc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(ordersTotal / ORDERS_PAGE_SIZE));

  const allOrderTotals = allOrders.map((order) => getOrderTotals(order));
  const submittedTotal = allOrderTotals.reduce((sum, order) => sum + order.goodsTotal, 0);
  const procurementState = getProcurementState(procurement, submittedTotal);

  const totalOrders = allOrders.length;
  const uniqueResidents = new Set(allOrders.map((o) => o.userId).filter(Boolean)).size;
  const goodsTotalSum = allOrderTotals.reduce((sum, order) => sum + order.goodsTotal, 0);
  const deliveryShareSum = allOrderTotals.reduce((sum, order) => sum + order.deliveryShare, 0);
  const grandTotalSum = allOrderTotals.reduce((sum, order) => sum + order.grandTotal, 0);

  const paymentBreakdown = {
    UNPAID: allOrders.filter((o) => o.paymentStatus === "UNPAID").length,
    PAID: allOrders.filter((o) => o.paymentStatus === "PAID").length,
    PAY_ON_PICKUP: allOrders.filter((o) => o.paymentStatus === "PAY_ON_PICKUP").length,
  };

  const issuedCount = allOrders.filter((o) => o.checkin).length;
  const notIssuedCount = totalOrders - issuedCount;

  // ── Top categories (over ALL orders) ─────────────────────────────────────
  const catMap = new Map();
  for (const order of allOrders) {
    for (const item of order.items) {
      const cat = item.product.category;
      const itemSum = item.qty * item.price;
      if (!catMap.has(cat.id)) catMap.set(cat.id, { name: cat.name, sum: 0, qty: 0 });
      const r = catMap.get(cat.id);
      r.sum += itemSum;
      r.qty += item.qty;
    }
  }
  const topCategories = Array.from(catMap.values()).sort((a, b) => b.sum - a.sum);

  // ── Top products (over ALL orders) ────────────────────────────────────────
  const prodMap = new Map();
  for (const order of allOrders) {
    for (const item of order.items) {
      const p = item.product;
      const itemSum = item.qty * item.price;
      if (!prodMap.has(p.id))
        prodMap.set(p.id, {
          name: p.name,
          category: p.category.name,
          unit: p.unit.name,
          sum: 0,
          qty: 0,
        });
      const r = prodMap.get(p.id);
      r.sum += itemSum;
      r.qty += item.qty;
    }
  }
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.sum - a.sum);

  // ── Query params helpers ──────────────────────────────────────────────────
  function filterHref(ps, s) {
    const q = new URLSearchParams();
    if (ps) q.set("paymentStatus", ps);
    if (s) q.set("search", s);
    q.set("page", "1");
    const str = q.toString();
    return `/admin/procurements/${id}/report${str ? `?${str}` : ""}`;
  }

  const preservedQuery = {};
  if (filterStatus) preservedQuery.paymentStatus = filterStatus;
  if (search) preservedQuery.search = search;

  return (
    <main className="cb-shell space-y-4 py-1">
      <div className="text-xs text-[color:var(--cb-text-faint)]">
        <Link href="/admin/procurements" className="hover:text-[color:var(--cb-text)]">
          Закупки
        </Link>{" "}
        /{" "}
        <Link href={`/admin/procurements/${id}`} className="hover:text-[color:var(--cb-text)]">
          {procurement.title}
        </Link>{" "}
        / <span className="font-medium text-[color:var(--cb-text-soft)]">Отчёт</span>
      </div>

      <PageHeader
        eyebrow="Операционный центр / отчёт"
        title="Отчёт по закупке"
        description={`${procurement.supplier.name} · ${procurement.settlement.region.name}, ${procurement.settlement.name} · ${procurement.pickupPoint.name}`}
        actions={
          <>
            <Link
              href={`/admin/procurements/${id}/report.xlsx`}
              className="inline-flex min-h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              XLSX
            </Link>
            <Link
              href={`/admin/procurements/${id}/report.pdf`}
              className="inline-flex min-h-9 items-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]"
            >
              PDF
            </Link>
          </>
        }
      />

      {procurementState.closedBecauseMinNotReached && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Минимальная сумма не достигнута: собрано {submittedTotal.toLocaleString("ru-RU")} ₽ из{" "}
          {procurement.minTotalSum.toLocaleString("ru-RU")} ₽. Закупка закрыта и находится в
          архиве.
        </div>
      )}

      {totalOrders === 0 && !filterStatus && !search && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            title="Подтверждённых заявок нет"
            description="Отчёт будет доступен после появления подтверждённых заявок"
          />
        </div>
      )}

      {totalOrders > 0 && (
        <>
          {/* KPI cards */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
              Сводка
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Заявок" value={totalOrders} />
              <StatCard label="Участников" value={uniqueResidents} />
              <StatCard label="Товары, ₽" value={goodsTotalSum.toLocaleString("ru-RU")} />
              <StatCard label="Доставка, ₽" value={deliveryShareSum.toLocaleString("ru-RU")} />
              <StatCard
                variant="primary"
                label="Итого к оплате, ₽"
                value={grandTotalSum.toLocaleString("ru-RU")}
              />
              <StatCard
                variant="success"
                label="Выдано"
                value={`${issuedCount} / ${totalOrders}`}
              />
              <StatCard
                variant="warning"
                label="Не выдано"
                value={notIssuedCount}
              />
              <StatCard
                label="Мин. сбор"
                value={
                  procurement.minTotalSum > 0
                    ? `${procurement.minTotalSum.toLocaleString("ru-RU")} ₽`
                    : "—"
                }
              />
            </div>
          </section>

          {/* Payment breakdown */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
              Оплата
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                variant="danger"
                label="Не оплачено"
                value={paymentBreakdown.UNPAID}
              />
              <StatCard
                variant="success"
                label="Оплачено"
                value={paymentBreakdown.PAID}
              />
              <StatCard
                variant="info"
                label={PAYMENT_LABELS.PAY_ON_PICKUP}
                value={paymentBreakdown.PAY_ON_PICKUP}
              />
            </div>
          </section>

          {/* Orders table with filter + search */}
          <Card>
            <CardHeader>
              <CardTitle>Заявки участников</CardTitle>
              <span className="text-xs text-zinc-400">{ordersTotal} шт. (всего {totalOrders})</span>
            </CardHeader>

            {/* Filter bar */}
            <div className="px-5 py-3 border-b border-zinc-100 flex flex-wrap items-center gap-2">
              {/* Payment status filter */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: "Все", value: "" },
                  { label: PAYMENT_LABELS.UNPAID, value: "UNPAID" },
                  { label: PAYMENT_LABELS.PAID, value: "PAID" },
                  { label: PAYMENT_LABELS.PAY_ON_PICKUP, value: "PAY_ON_PICKUP" },
                ].map((opt) => (
                  <Link
                    key={opt.value}
                    href={filterHref(opt.value, search)}
                    className={[
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      filterStatus === opt.value
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>

              {/* Search */}
              <form method="get" action={`/admin/procurements/${id}/report`} className="ml-auto flex gap-2">
                {filterStatus && (
                  <input type="hidden" name="paymentStatus" value={filterStatus} />
                )}
                <input type="hidden" name="page" value="1" />
                <input
                  name="search"
                  defaultValue={search}
                  placeholder="Имя или телефон…"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Найти
                </button>
                {search && (
                  <Link
                    href={filterHref(filterStatus, "")}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    ✕ Сброс
                  </Link>
                )}
              </form>
            </div>

            {ordersPage.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400">
                Заявки не найдены
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                      <th className="px-4 py-3 font-medium">Участник</th>
                      <th className="px-4 py-3 font-medium text-right">Товары, ₽</th>
                      <th className="px-4 py-3 font-medium text-right">Доставка, ₽</th>
                      <th className="px-4 py-3 font-medium text-right">Итого, ₽</th>
                      <th className="px-4 py-3 font-medium">Оплата</th>
                      <th className="px-4 py-3 font-medium">Выдача</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersPage.map((order, idx) => (
                      (() => {
                        const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
                        return (
                          <tr
                            key={order.id}
                            className={[
                              "border-b last:border-0 transition-colors",
                              idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40",
                              "hover:bg-indigo-50/20",
                            ].join(" ")}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-zinc-900">
                                {order.participantName ?? "—"}
                              </div>
                              {order.participantPhone && (
                                <div className="text-xs text-zinc-400">{order.participantPhone}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-700">
                              {goodsTotal.toLocaleString("ru-RU")}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-500">
                              {deliveryShare.toLocaleString("ru-RU")}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                              {grandTotal.toLocaleString("ru-RU")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                                {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {order.checkin ? (
                                <Badge variant="success">Выдан</Badge>
                              ) : (
                                <Badge variant="neutral">Ожидает</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 pb-3">
              <Pager
                page={page}
                totalPages={totalPages}
                baseUrl={`/admin/procurements/${id}/report`}
                query={preservedQuery}
              />
            </div>
          </Card>

          {/* Top categories */}
          {topCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Топ категорий по сумме</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                      <th className="px-4 py-3 font-medium">Категория</th>
                      <th className="px-4 py-3 font-medium text-right">Кол-во</th>
                      <th className="px-4 py-3 font-medium text-right">Сумма, ₽</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCategories.map((cat, idx) => (
                      <tr
                        key={cat.name}
                        className={[
                          "border-b last:border-0 transition-colors",
                          idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40",
                          "hover:bg-indigo-50/20",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900">{cat.name}</td>
                        <td className="px-4 py-3 text-right text-zinc-700">{cat.qty}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          {cat.sum.toLocaleString("ru-RU")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Top products */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Топ товаров по сумме</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                      <th className="px-4 py-3 font-medium">Товар</th>
                      <th className="px-4 py-3 font-medium">Категория</th>
                      <th className="px-4 py-3 font-medium">Ед.</th>
                      <th className="px-4 py-3 font-medium text-right">Кол-во</th>
                      <th className="px-4 py-3 font-medium text-right">Сумма, ₽</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((prod, idx) => (
                      <tr
                        key={prod.name}
                        className={[
                          "border-b last:border-0 transition-colors",
                          idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40",
                          "hover:bg-indigo-50/20",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900">{prod.name}</td>
                        <td className="px-4 py-3 text-zinc-500">{prod.category}</td>
                        <td className="px-4 py-3 text-zinc-500">{prod.unit}</td>
                        <td className="px-4 py-3 text-right text-zinc-700">{prod.qty}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          {prod.sum.toLocaleString("ru-RU")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
