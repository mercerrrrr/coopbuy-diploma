"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { InlineMessage } from "@/components/ui/InlineMessage";

function Msg({ state }) {
  if (!state?.message) return null;
  return (
    <InlineMessage
      type={state.ok ? "success" : "error"}
      className="mt-3"
      role="status"
      aria-live="polite"
    >
      {state.message}
    </InlineMessage>
  );
}

function SubmitButton({ children }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
    >
      {pending ? "Создаём..." : children}
    </button>
  );
}

/**
 * suppliers: [{id, name, minOrderSum}]
 * settlements: [{id, label}]
 * pickupPoints: [{id, label, settlementId}]
 * operatorPickupPointId / operatorSettlementId: lock fields for OPERATOR role
 */
export function CreateProcurementForm({
  action,
  suppliers,
  settlements,
  pickupPoints,
  operatorPickupPointId,
  operatorSettlementId,
}) {
  const [state, formAction] = useActionState(action, null);

  const [supplierId, setSupplierId] = useState("");
  const [settlementId, setSettlementId] = useState(operatorSettlementId ?? "");

  const isOperator = Boolean(operatorPickupPointId);

  const supplierMinSum = useMemo(() => {
    const s = suppliers.find((x) => x.id === supplierId);
    return s ? String(s.minOrderSum) : "0";
  }, [supplierId, suppliers]);

  const filteredPickupPoints = useMemo(() => {
    return pickupPoints.filter((p) => p.settlementId === settlementId);
  }, [pickupPoints, settlementId]);

  const operatorPickupLabel = useMemo(() => {
    if (!isOperator) return null;
    return pickupPoints.find((p) => p.id === operatorPickupPointId)?.label ?? operatorPickupPointId;
  }, [isOperator, operatorPickupPointId, pickupPoints]);

  const operatorSettlementLabel = useMemo(() => {
    if (!isOperator) return null;
    return settlements.find((s) => s.id === operatorSettlementId)?.label ?? operatorSettlementId;
  }, [isOperator, operatorSettlementId, settlements]);

  return (
    <div>
      <form action={formAction} className="mt-3 space-y-4">
        <section className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-[color:var(--cb-text)]">Основные поля</div>
            <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
              Сначала настройте поставщика, населённый пункт, ПВЗ и дедлайн.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="procurement-title" className="block text-sm font-medium text-zinc-700">
                Название закупки
              </label>
              <input
                id="procurement-title"
                name="title"
                placeholder="Название закупки (например: Продукты и хозтовары на неделю)"
                maxLength={200}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="procurement-supplier" className="block text-sm font-medium text-zinc-700">
                Поставщик
              </label>
              <select
                id="procurement-supplier"
                name="supplierId"
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="" disabled>
                  Поставщик…
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (мин: {s.minOrderSum} ₽)
                  </option>
                ))}
              </select>
            </div>

            {isOperator ? (
              <>
                <input type="hidden" name="settlementId" value={operatorSettlementId} />
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-zinc-700">Населённый пункт</span>
                  <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                    {operatorSettlementLabel}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="procurement-settlement"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Населённый пункт
                </label>
                <select
                  id="procurement-settlement"
                  name="settlementId"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  value={settlementId}
                  onChange={(e) => setSettlementId(e.target.value)}
                >
                  <option value="" disabled>
                    Населённый пункт…
                  </option>
                  {settlements.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isOperator ? (
              <>
                <input type="hidden" name="pickupPointId" value={operatorPickupPointId} />
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-zinc-700">Пункт выдачи</span>
                  <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                    {operatorPickupLabel}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="procurement-pickup-point"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Пункт выдачи
                </label>
                <select
                  id="procurement-pickup-point"
                  name="pickupPointId"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Пункт выдачи…
                  </option>
                  {filteredPickupPoints.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="procurement-deadline" className="block text-sm font-medium text-zinc-700">
                Дедлайн
              </label>
              <input
                id="procurement-deadline"
                name="deadlineAt"
                type="datetime-local"
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="procurement-min-total" className="block text-sm font-medium text-zinc-700">
                Минимальный общий сбор
              </label>
              <input
                id="procurement-min-total"
                name="minTotalSum"
                defaultValue={supplierMinSum}
                placeholder="Мин. общий сбор (например: 10000)"
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
          </div>
        </section>

        <details className="rounded-[1rem] border border-[color:var(--cb-line)] bg-white">
          <summary className="cursor-pointer list-none px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--cb-text)]">
                  Дополнительные настройки
                </div>
                <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                  Окно выдачи, инструкция и параметры доставки.
                </div>
              </div>
              <span className="rounded-md border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-2.5 py-1 text-xs text-[color:var(--cb-text-soft)]">
                Необязательно
              </span>
            </div>
          </summary>

          <div className="border-t border-[color:var(--cb-line)] px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="procurement-pickup-window-start"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Начало окна выдачи
                </label>
                <input
                  id="procurement-pickup-window-start"
                  name="pickupWindowStart"
                  type="datetime-local"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="procurement-pickup-window-end"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Конец окна выдачи
                </label>
                <input
                  id="procurement-pickup-window-end"
                  name="pickupWindowEnd"
                  type="datetime-local"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="procurement-delivery-fee"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Стоимость доставки
                </label>
                <input
                  id="procurement-delivery-fee"
                  name="deliveryFee"
                  defaultValue="0"
                  placeholder="0"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="procurement-delivery-split-mode"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Распределение доставки
                </label>
                <select
                  id="procurement-delivery-split-mode"
                  name="deliverySplitMode"
                  defaultValue="PROPORTIONAL_SUM"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  <option value="PROPORTIONAL_SUM">Пропорционально сумме</option>
                  <option value="EQUAL">Поровну</option>
                  <option value="PER_ITEM">По количеству товаров</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="procurement-pickup-instructions"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Инструкции для участников
                </label>
                <textarea
                  id="procurement-pickup-instructions"
                  name="pickupInstructions"
                  placeholder="Например: прийти с 18:00 до 20:00, взять паспорт"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>
            </div>
          </div>
        </details>

        <div>
          <SubmitButton>Создать закупку</SubmitButton>
        </div>
      </form>

      <Msg state={state} />
    </div>
  );
}
