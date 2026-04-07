import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, FilePdf, QrCode } from "@phosphor-icons/react/ssr";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAYMENT_LABELS, PAYMENT_VARIANTS } from "@/lib/constants";
import { getOrderTotals } from "@/lib/orders";
import { PrintPageButton } from "./PrintPageButton";

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

  const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
  const isCheckedIn = Boolean(order.checkin);
  const qrDataUrl = await QRCode.toDataURL(order.id, { margin: 1, width: 220 });

  return (
    <main className="cb-shell space-y-4 py-1">
      <Link
        href="/my/orders"
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--cb-text-soft)] transition-colors hover:text-[color:var(--cb-text)]"
      >
        <ArrowLeft size={14} />
        К списку заказов
      </Link>

      <PageHeader
        eyebrow="Личный кабинет / карточка заказа"
        title={order.procurement.title}
        description={`Поставщик ${order.procurement.supplier.name}. Пункт выдачи ${order.procurement.pickupPoint.name}. Эта страница выступает основной квитанцией заказа: здесь собраны состав, сумма, статус оплаты и QR-код.`}
        meta={
          <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3">
            <div className="cb-kicker">Статус выдачи</div>
            <div className="mt-1.5">
              {isCheckedIn ? <Badge variant="success">Выдано</Badge> : <Badge variant="neutral">Ожидает выдачи</Badge>}
            </div>
          </div>
        }
      />

      <InlineMessage type="info">
        Основная квитанция доступна прямо на этой странице. Для бумажной версии используйте печать браузера или сохранение в PDF.
      </InlineMessage>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.82fr]">
        <div className="cb-panel-strong rounded-[1.25rem] p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold leading-snug text-[color:var(--cb-text)]">
                Состав и расчёт заказа
              </div>
              <div className="mt-1.5 text-sm text-[color:var(--cb-text-soft)]">
                {order.procurement.supplier.name} · {order.procurement.pickupPoint.name}
              </div>
              <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                {order.procurement.settlement.name}
                {order.procurement.settlement.region.name
                  ? ` · ${order.procurement.settlement.region.name}`
                  : ""}
              </div>
            </div>
            <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
              {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--cb-text-faint)]">Участник</div>
              <div className="mt-2 font-medium text-[color:var(--cb-text)]">{order.participantName ?? "—"}</div>
              {order.participantPhone && (
                <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">{order.participantPhone}</div>
              )}
            </div>
            <div className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--cb-text-faint)]">К оплате</div>
              <div className="mt-2 text-xl font-semibold text-[color:var(--cb-text)]">
                {grandTotal.toLocaleString("ru-RU")} ₽
              </div>
            </div>
            <div className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--cb-text-faint)]">Оплата</div>
              <div className="mt-2">
                <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                  {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </Badge>
              </div>
            </div>
          </div>

          {order.procurement.pickupWindowStart && (
            <div className="mt-4 rounded-[1rem] border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900">
              Окно выдачи:{" "}
              <span className="font-medium">
                {new Date(order.procurement.pickupWindowStart).toLocaleString("ru-RU")}
                {order.procurement.pickupWindowEnd &&
                  ` — ${new Date(order.procurement.pickupWindowEnd).toLocaleString("ru-RU")}`}
              </span>
              {order.procurement.pickupInstructions && (
                <div className="mt-1.5 text-sky-800">{order.procurement.pickupInstructions}</div>
              )}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-[1.1rem] border border-[color:var(--cb-line)]">
            <div className="border-b border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3 text-sm font-medium text-[color:var(--cb-text)]">
              Состав заказа
            </div>
            <ul className="bg-white">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-4 border-b border-[color:var(--cb-line)] px-4 py-3 text-sm text-[color:var(--cb-text-soft)] last:border-b-0"
                >
                  <span className="font-medium text-[color:var(--cb-text)]">{item.product.name}</span>
                  <span>
                    {item.qty} × {item.price} ₽ ={" "}
                    <span className="font-medium text-[color:var(--cb-text)]">
                      {(item.qty * item.price).toLocaleString("ru-RU")} ₽
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-[1.1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-4 space-y-2">
            {deliveryShare > 0 && (
              <>
                <div className="flex justify-between text-sm text-[color:var(--cb-text-soft)]">
                  <span>Товары</span>
                  <span>{goodsTotal.toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="flex justify-between text-sm text-[color:var(--cb-text-soft)]">
                  <span>Доставка</span>
                  <span>{deliveryShare.toLocaleString("ru-RU")} ₽</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-semibold text-[color:var(--cb-text)]">
              <span>К оплате</span>
              <span>{grandTotal.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <PrintPageButton />
              <Link
                href={`/my/orders/${order.id}/receipt.pdf`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
              >
                <FilePdf size={16} />
                Открыть PDF-квитанцию
              </Link>
            </div>
          </div>
        </div>

        <div className="cb-panel-strong rounded-[1.25rem] p-4 text-center md:p-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent)]">
            <QrCode size={20} weight="bold" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-[color:var(--cb-text)]">QR-код заказа</div>
          <p className="mt-2 text-sm text-[color:var(--cb-text-soft)]">
            Покажите код оператору в пункте выдачи. Здесь же сохранён идентификатор заказа.
          </p>

          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR-код заявки"
              width={240}
              height={240}
              className="rounded-[1.25rem] border border-[color:var(--cb-line)] bg-white p-3 shadow-[var(--cb-shadow-xs)]"
            />
          </div>

          <div className="mt-4 rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3 text-left">
            <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--cb-text-faint)]">ID заказа</div>
            <p className="mt-2 break-all font-mono text-sm text-[color:var(--cb-text-soft)]">{order.id}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
