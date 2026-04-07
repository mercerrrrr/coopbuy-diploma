"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import {
  getAllowedPaymentStatusTransitions,
  PAYMENT_LABELS,
  PAYMENT_VARIANTS,
} from "@/lib/constants";
import { getOrderTotals } from "@/lib/orders";

const PAYMENT_ACTION_STYLES = {
  PAID: "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors",
  PAY_ON_PICKUP:
    "rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800 hover:bg-sky-100 transition-colors",
  UNPAID:
    "rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors",
};

function PaymentTransitionButton({ status }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="paymentStatus"
      value={status}
      disabled={pending}
      className={`${PAYMENT_ACTION_STYLES[status] ?? PAYMENT_ACTION_STYLES.UNPAID} disabled:opacity-50`}
    >
      {PAYMENT_LABELS[status] ?? status}
    </button>
  );
}

function PaymentStatusForm({ orderId, procurementId, currentStatus, action }) {
  const [state, formAction] = useActionState(action, null);
  const nextStatuses = getAllowedPaymentStatusTransitions(currentStatus);

  if (nextStatuses.length === 0) {
    return <span className="text-xs text-zinc-400">Изменение недоступно</span>;
  }

  return (
    <div className="space-y-1">
      <form action={formAction} className="flex gap-1 flex-wrap justify-end">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="procurementId" value={procurementId} />
        {nextStatuses.map((status) => (
          <PaymentTransitionButton key={status} status={status} />
        ))}
      </form>
      {state?.error && (
        <p role="status" aria-live="polite" className="text-right text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function OrdersSearchTable({ orders, procurementId, updatePaymentStatus }) {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const filtered = q
    ? orders.filter(
        (o) =>
          (o.participantName ?? "").toLowerCase().includes(q) ||
          (o.participantPhone ?? "").toLowerCase().includes(q) ||
          PAYMENT_LABELS[o.paymentStatus]?.toLowerCase().includes(q)
      )
    : orders;

  return (
    <div className="space-y-3">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Поиск по участнику, телефону, статусу..."
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-400">
          {q ? `Ничего не найдено по запросу «${q}»` : "Нет данных"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2.5 font-medium">Участник</th>
                <th className="px-3 py-2.5 font-medium text-right">Товары</th>
                <th className="px-3 py-2.5 font-medium text-right">Доставка</th>
                <th className="px-3 py-2.5 font-medium text-right">Итого</th>
                <th className="px-3 py-2.5 font-medium">Оплата</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((order, idx) => {
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
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-zinc-900">
                        {order.participantName ?? "—"}
                      </div>
                      {order.participantPhone && (
                        <div className="text-xs text-zinc-400">
                          {order.participantPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-700">
                      {goodsTotal.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">
                      {deliveryShare.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-zinc-900">
                      {grandTotal.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                        {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <PaymentStatusForm
                        orderId={order.id}
                        procurementId={procurementId}
                        currentStatus={order.paymentStatus}
                        action={updatePaymentStatus}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {q && filtered.length > 0 && (
        <p className="text-xs text-zinc-400">
          Показано {filtered.length} из {orders.length}
        </p>
      )}
    </div>
  );
}
