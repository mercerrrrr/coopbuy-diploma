import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { Package } from "lucide-react";

const PAGE_SIZE = 10;

const PAYMENT_LABELS = {
  UNPAID: "Не оплачено",
  PAID: "Оплачено",
  PAY_ON_PICKUP: "При выдаче",
};

const PAYMENT_VARIANTS = {
  UNPAID: "danger",
  PAID: "success",
  PAY_ON_PICKUP: "info",
};

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Мои заявки</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {total > 0
            ? `${total} подтверждённых заявок`
            : "Подтверждённых заявок пока нет"}
        </p>
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<Package size={36} />}
            title="Заявок пока нет"
            description="Ваши подтверждённые заявки появятся здесь"
            action={
              <Link
                href="/my/procurements"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Перейти к закупкам
              </Link>
            }
          />
        </div>
      )}

      {orders.map((order) => {
        const goodsTotal =
          order.goodsTotal ?? order.items.reduce((s, i) => s + i.qty * i.price, 0);
        const deliveryShare = order.deliveryShare ?? 0;
        const grandTotal = order.grandTotal ?? goodsTotal;
        const isCheckedIn = Boolean(order.checkin);

        return (
          <div
            key={order.id}
            className="rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-zinc-900">{order.procurement.title}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {order.procurement.supplier.name} · {order.procurement.pickupPoint.name}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {order.procurement.settlement.region.name} ·{" "}
                  {order.procurement.settlement.name}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-lg font-bold text-zinc-900">
                  {grandTotal.toLocaleString("ru-RU")} ₽
                </span>
                {deliveryShare > 0 && (
                  <span className="text-xs text-zinc-400">
                    товары {goodsTotal.toLocaleString("ru-RU")} + доставка{" "}
                    {deliveryShare.toLocaleString("ru-RU")} ₽
                  </span>
                )}
                <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                  {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </Badge>
                {isCheckedIn ? (
                  <Badge variant="success">Выдано</Badge>
                ) : (
                  <Badge variant="neutral">Ожидает выдачи</Badge>
                )}
              </div>
            </div>

            <ul className="space-y-1.5 border-t border-zinc-100 pt-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm text-zinc-600">
                  <span>{item.product.name}</span>
                  <span className="text-zinc-500">
                    {item.qty} × {item.price} ₽ ={" "}
                    <span className="font-medium text-zinc-800">
                      {(item.qty * item.price).toLocaleString("ru-RU")} ₽
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex gap-4 pt-1 border-t border-zinc-100">
              <Link
                href={`/my/orders/${order.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Подробнее / QR →
              </Link>
              <Link
                href={`/my/orders/${order.id}/receipt.pdf`}
                className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                Квитанция PDF
              </Link>
            </div>
          </div>
        );
      })}

      <Pager page={page} totalPages={totalPages} baseUrl="/my/orders" />
    </main>
  );
}
