import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { Package } from "@phosphor-icons/react/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAYMENT_LABELS, PAYMENT_VARIANTS } from "@/lib/constants";
import { getOrderTotals, getOrdersGrandTotal } from "@/lib/orders";

const PAGE_SIZE = 10;

export default async function MyOrdersPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/my/orders");

  const userId = String(session.sub);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);

  const where = { userId, status: "SUBMITTED" };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        procurement: {
          include: { supplier: true, pickupPoint: true, settlement: { include: { region: true } } },
        },
        checkin: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalGrand = getOrdersGrandTotal(orders);

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Личный кабинет / заказы"
        title="Подтверждённые заказы"
        description={
          total > 0
            ? `${total} подтверждённых заказов в истории. Откройте страницу заказа, чтобы показать QR-код, распечатать квитанцию или сохранить её в PDF.`
            : "Здесь появятся подтверждённые заказы после оформления участия в закупке."
        }
        meta={
          <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-left md:text-right">
            <div className="cb-kicker">К оплате на странице</div>
            <div className="mt-1.5 text-xl font-semibold text-[color:var(--cb-text)]">
              {totalGrand.toLocaleString("ru-RU")} ₽
            </div>
            <div className="text-xs text-[color:var(--cb-text-soft)]">суммарно по текущему списку</div>
          </div>
        }
      />

      {total === 0 && (
        <div className="cb-panel-strong rounded-[1.1rem]">
          <EmptyState
            icon={<Package size={36} />}
            title="Заявок пока нет"
            description="Ваши подтверждённые заявки появятся здесь"
            action={
              <Link
                href="/my/procurements"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
              >
                Перейти к закупкам
              </Link>
            }
          />
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {orders.map((order) => {
          const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
          const isCheckedIn = Boolean(order.checkin);

          return (
            <div
              key={order.id}
              className="cb-panel-strong rounded-[1.1rem] p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-2xl">
                  <div className="text-lg font-semibold text-[color:var(--cb-text)]">{order.procurement.title}</div>
                  <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                    {order.procurement.supplier.name} · {order.procurement.pickupPoint.name}
                    {order.procurement.pickupPoint.address && (
                      <span className="text-[color:var(--cb-text-faint)]"> — {order.procurement.pickupPoint.address}</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                    {order.procurement.settlement.name}
                    {order.procurement.settlement.region.name
                      ? ` · ${order.procurement.settlement.region.name}`
                      : ""}
                  </div>
                </div>
                <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-right">
                  <div className="cb-kicker">Итого</div>
                  <span className="mt-1.5 block text-xl font-semibold text-[color:var(--cb-text)]">
                    {grandTotal.toLocaleString("ru-RU")} ₽
                  </span>
                  {deliveryShare > 0 && (
                    <span className="text-xs text-[color:var(--cb-text-soft)]">
                      товары {goodsTotal.toLocaleString("ru-RU")} + доставка {deliveryShare.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                  {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </Badge>
                {isCheckedIn ? (
                  <Badge variant="success">Выдано</Badge>
                ) : (
                  <Badge variant="neutral">Ожидает выдачи</Badge>
                )}
              </div>

              <ul className="mt-3 divide-y divide-[color:var(--cb-line)] rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 px-3.5 py-2.5 text-sm">
                    <span className="font-medium text-[color:var(--cb-text)]">{item.product.name}</span>
                    <span className="text-[color:var(--cb-text-soft)]">
                      {item.qty} × {item.price} ₽ ={" "}
                      <span className="font-medium text-[color:var(--cb-text)]">
                        {(item.qty * item.price).toLocaleString("ru-RU")} ₽
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href={`/my/orders/${order.id}`}
                  className="text-sm font-medium text-[color:var(--cb-accent)] hover:text-[color:var(--cb-accent-strong)]"
                >
                  Страница заказа и QR
                </Link>
                <Link
                  href={`/my/orders/${order.id}/receipt.pdf`}
                  className="text-sm text-[color:var(--cb-text-soft)] hover:text-[color:var(--cb-text)]"
                >
                  PDF-квитанция
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      <Pager page={page} totalPages={totalPages} baseUrl="/my/orders" />
    </main>
  );
}
