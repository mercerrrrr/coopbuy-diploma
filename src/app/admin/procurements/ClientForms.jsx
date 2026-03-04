"use client";

import { useActionState, useMemo, useState } from "react";

function Msg({ state }) {
  if (!state?.message) return null;
  return (
    <div
      className={[
        "mt-3 rounded-xl border px-3 py-2 text-sm",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900",
      ].join(" ")}
    >
      {state.message}
    </div>
  );
}

function SubmitButton({ children }) {
  return (
    <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
      {children}
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
      <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          name="title"
          placeholder="Название закупки (например: Продукты и хозтовары на неделю)"
          className="md:col-span-2 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <select
          name="supplierId"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
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

        {/* Settlement — locked for OPERATOR */}
        {isOperator ? (
          <>
            <input type="hidden" name="settlementId" value={operatorSettlementId} />
            <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              {operatorSettlementLabel}
            </div>
          </>
        ) : (
          <select
            name="settlementId"
            className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
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
        )}

        {/* Pickup point — locked for OPERATOR */}
        {isOperator ? (
          <>
            <input type="hidden" name="pickupPointId" value={operatorPickupPointId} />
            <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              {operatorPickupLabel}
            </div>
          </>
        ) : (
          <select
            name="pickupPointId"
            className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
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
        )}

        <input
          name="deadlineAt"
          type="datetime-local"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <input
          name="minTotalSum"
          defaultValue={supplierMinSum}
          placeholder="Мин. общий сбор (например: 10000)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        {/* Pickup window — optional */}
        <div className="md:col-span-2 border-t pt-3">
          <div className="text-xs text-zinc-500 mb-2">Окно выдачи (необязательно)</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="pickupWindowStart"
              type="datetime-local"
              className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
            />
            <input
              name="pickupWindowEnd"
              type="datetime-local"
              className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
            />
            <textarea
              name="pickupInstructions"
              placeholder="Инструкции для участников (например: прийти с 18:00 до 20:00, взять паспорт)"
              rows={2}
              className="md:col-span-2 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <SubmitButton>Создать закупку</SubmitButton>
        </div>
      </form>

      <Msg state={state} />
    </div>
  );
}
