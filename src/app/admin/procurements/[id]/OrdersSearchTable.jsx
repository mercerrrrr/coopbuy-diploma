"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";

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
                const gt =
                  order.goodsTotal ??
                  order.items.reduce((s, i) => s + i.qty * i.price, 0);
                const ds = order.deliveryShare ?? 0;
                const grand = order.grandTotal ?? gt;
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
                      {gt.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">
                      {ds.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-zinc-900">
                      {grand.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                        {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap justify-end">
                        {order.paymentStatus !== "PAID" && (
                          <form action={updatePaymentStatus}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="procurementId" value={procurementId} />
                            <input type="hidden" name="paymentStatus" value="PAID" />
                            <button className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors">
                              Оплачено
                            </button>
                          </form>
                        )}
                        {order.paymentStatus !== "PAY_ON_PICKUP" && (
                          <form action={updatePaymentStatus}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="procurementId" value={procurementId} />
                            <input type="hidden" name="paymentStatus" value="PAY_ON_PICKUP" />
                            <button className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800 hover:bg-sky-100 transition-colors">
                              При выдаче
                            </button>
                          </form>
                        )}
                        {order.paymentStatus !== "UNPAID" && (
                          <form action={updatePaymentStatus}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="procurementId" value={procurementId} />
                            <input type="hidden" name="paymentStatus" value="UNPAID" />
                            <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">
                              Сбросить
                            </button>
                          </form>
                        )}
                      </div>
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
