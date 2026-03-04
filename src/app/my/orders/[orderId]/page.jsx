import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { ChevronLeft, FileDown } from "lucide-react";

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

export default async function OrderDetailPage({ params }) {
  const { orderId } = await params;

  const session = await getSession();
  if (!session) redirect(`/auth/login?next=/my/orders/${orderId}`);

  const userId = String(session.sub);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      procurement: {
        include: {
          supplier: true,
          pickupPoint: true,
          settlement: { include: { region: true } },
        },
      },
      checkin: true,
    },
  });

  if (!order || order.userId !== userId || order.status !== "SUBMITTED") {
    notFound();
  }

  const goodsTotal = order.goodsTotal ?? order.items.reduce((s, i) => s + i.qty * i.price, 0);
  const deliveryShare = order.deliveryShare ?? 0;
  const grandTotal = order.grandTotal ?? goodsTotal;
  const isCheckedIn = Boolean(order.checkin);

  const qrDataUrl = await QRCode.toDataURL(order.id, { margin: 1, width: 220 });

  return (
    <main className="mx-auto max-w-lg px-6 py-6 space-y-4">
      <Link
        href="/my/orders"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ChevronLeft size={14} />
        Мои заявки
      </Link>

      {/* Order card */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-zinc-900 leading-snug">
              {order.procurement.title}
            </div>
            <div className="text-sm text-zinc-500 mt-0.5">
              {order.procurement.supplier.name} · {order.procurement.pickupPoint.name}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {order.procurement.settlement.region.name} ·{" "}
              {order.procurement.settlement.name}
            </div>
          </div>
          <div className="shrink-0">
            {isCheckedIn ? (
              <Badge variant="success">Выдано</Badge>
            ) : (
              <Badge variant="neutral">Ожидает выдачи</Badge>
            )}
          </div>
        </div>

        <div className="text-sm text-zinc-600">
          Участник:{" "}
          <span className="font-medium text-zinc-900">{order.participantName ?? "—"}</span>
          {order.participantPhone && (
            <span className="text-zinc-400 ml-2">{order.participantPhone}</span>
          )}
        </div>

        {order.procurement.pickupWindowStart && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            Окно выдачи:{" "}
            <span className="font-medium">
              {new Date(order.procurement.pickupWindowStart).toLocaleString("ru-RU")}
              {order.procurement.pickupWindowEnd &&
                ` — ${new Date(order.procurement.pickupWindowEnd).toLocaleString("ru-RU")}`}
            </span>
            {order.procurement.pickupInstructions && (
              <div className="mt-1 text-sky-800">{order.procurement.pickupInstructions}</div>
            )}
          </div>
        )}

        {/* Items */}
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

        {/* Payment summary */}
        <div className="border-t border-zinc-100 pt-3 space-y-1.5">
          {deliveryShare > 0 && (
            <>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Товары</span>
                <span>{goodsTotal.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Доставка</span>
                <span>{deliveryShare.toLocaleString("ru-RU")} ₽</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm font-bold text-zinc-900">
            <span>К оплате</span>
            <span>{grandTotal.toLocaleString("ru-RU")} ₽</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-500">Статус оплаты</span>
            <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
              {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
          </div>
        </div>

        {/* Receipt download */}
        <div className="pt-2 border-t border-zinc-100">
          <Link
            href={`/my/orders/${order.id}/receipt.pdf`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            <FileDown size={15} />
            Скачать квитанцию PDF
          </Link>
        </div>
      </div>

      {/* QR code */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 text-center space-y-3">
        <div className="text-sm font-semibold text-zinc-900">QR-код для выдачи</div>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR-код заявки"
            width={220}
            height={220}
            className="rounded-xl"
          />
        </div>
        <p className="text-xs text-zinc-500">
          Покажите QR-код оператору в пункте выдачи
        </p>
        <p className="text-xs font-mono text-zinc-400 break-all">{order.id}</p>
      </div>
    </main>
  );
}
