import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAccessibleProcurement } from "@/lib/guards";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAYMENT_LABELS, PAYMENT_VARIANTS } from "@/lib/constants";
import { checkinOrder } from "@/app/admin/procurements/[id]/actions";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default async function CheckinPage({ params }) {
  const { orderId } = await params;

  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    redirect("/auth/login");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { unit: true, category: true } } } },
      procurement: {
        include: {
          supplier: true,
          pickupPoint: true,
          pickupSession: true,
        },
      },
      checkin: true,
    },
  });

  if (!order) notFound();

  // Verify operator has access to this procurement's pickup point
  try {
    await requireAccessibleProcurement(order.procurementId, { select: { id: true } });
  } catch {
    redirect("/403");
  }

  const isCheckedIn = Boolean(order.checkin);
  const isUnpaid = order.paymentStatus === "UNPAID";
  const pickupSession = order.procurement.pickupSession;
  const canCheckin =
    !isCheckedIn &&
    !isUnpaid &&
    pickupSession &&
    pickupSession.status !== "CLOSED" &&
    order.status === "SUBMITTED";

  const fmt = (v) => (v != null ? `${v} \u20BD` : "\u2014");

  return (
    <main className="cb-shell max-w-2xl space-y-4 py-4">
      <Link
        href="/admin/checkin"
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--cb-text-soft)] transition-colors hover:text-[color:var(--cb-text)]"
      >
        <ArrowLeft size={14} />
        К выдаче
      </Link>

      <PageHeader
        eyebrow="Выдача заказа"
        title={order.participantName ?? "Участник"}
        description={`Закупка: ${order.procurement.title} \u2022 ${order.procurement.supplier.name} \u2022 ${order.procurement.pickupPoint.name}`}
        meta={
          <div className="flex flex-col items-end gap-2">
            <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
              {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
            {isCheckedIn && <Badge variant="success">Выдано</Badge>}
          </div>
        }
      />

      {/* Status messages */}
      {isCheckedIn && (
        <InlineMessage type="success">
          Заказ выдан{" "}
          {order.checkin.checkedAt
            ? new Date(order.checkin.checkedAt).toLocaleString("ru-RU")
            : ""}
          .
        </InlineMessage>
      )}
      {isUnpaid && !isCheckedIn && (
        <InlineMessage type="error">
          Заказ не оплачен. Выдача невозможна до смены статуса оплаты.
        </InlineMessage>
      )}
      {!pickupSession && !isCheckedIn && (
        <InlineMessage type="warning">
          Сессия выдачи ещё не создана для этой закупки. Создайте сессию на странице закупки.
        </InlineMessage>
      )}
      {pickupSession?.status === "CLOSED" && !isCheckedIn && (
        <InlineMessage type="warning">
          Сессия выдачи закрыта.
        </InlineMessage>
      )}

      {/* Participant info + pickup code */}
      <Card>
        <CardHeader>
          <CardTitle>Участник</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[color:var(--cb-text-soft)]">Имя</dt>
            <dd className="font-medium text-[color:var(--cb-text)]">{order.participantName ?? "\u2014"}</dd>
            <dt className="text-[color:var(--cb-text-soft)]">Телефон</dt>
            <dd className="font-medium text-[color:var(--cb-text)]">{order.participantPhone ?? "\u2014"}</dd>
            {order.pickupCode && (
              <>
                <dt className="text-[color:var(--cb-text-soft)]">Код получения</dt>
                <dd className="font-mono text-lg font-bold tracking-widest text-[color:var(--cb-accent)]">
                  {order.pickupCode}
                </dd>
              </>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Order items */}
      <Card>
        <CardHeader>
          <CardTitle>Состав заказа</CardTitle>
          <span className="text-sm text-[color:var(--cb-text-soft)]">
            {order.items.length} поз.
          </span>
        </CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--cb-line)] text-left text-xs uppercase tracking-wider text-[color:var(--cb-text-faint)]">
                <th className="px-4 py-2.5">Товар</th>
                <th className="px-4 py-2.5 text-right">Кол-во</th>
                <th className="px-4 py-2.5 text-right">Цена</th>
                <th className="px-4 py-2.5 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-[color:var(--cb-line)] last:border-0">
                  <td className="px-4 py-2.5">
                    {item.product.name}
                    <span className="ml-1 text-xs text-[color:var(--cb-text-faint)]">
                      {item.product.unit?.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{item.price} \u20BD</td>
                  <td className="px-4 py-2.5 text-right font-medium">{item.quantity * item.price} \u20BD</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Totals */}
      <Card>
        <CardBody>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[color:var(--cb-text-soft)]">Товары</span>
              <span className="font-medium">{fmt(order.goodsTotal)}</span>
            </div>
            {order.deliveryShare != null && order.deliveryShare > 0 && (
              <div className="flex justify-between">
                <span className="text-[color:var(--cb-text-soft)]">Доставка</span>
                <span className="font-medium">{fmt(order.deliveryShare)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[color:var(--cb-line)] pt-2 text-base font-semibold">
              <span>К оплате</span>
              <span>{fmt(order.grandTotal)}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Checkin action */}
      {canCheckin && (
        <form action={checkinOrder} className="flex justify-center">
          <input type="hidden" name="sessionId" value={pickupSession.id} />
          <input type="hidden" name="orderId" value={order.id} />
          <Button type="submit" variant="success" size="lg" className="gap-2 px-8 text-base">
            <CheckCircle size={20} />
            Выдать заказ
          </Button>
        </form>
      )}
    </main>
  );
}
