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
 */
export function CreateProcurementForm({ action, suppliers, settlements, pickupPoints }) {
  const [state, formAction] = useActionState(action, null);

  const [supplierId, setSupplierId] = useState("");
  const [settlementId, setSettlementId] = useState("");

  const supplierMinSum = useMemo(() => {
    const s = suppliers.find((x) => x.id === supplierId);
    return s ? String(s.minOrderSum) : "0";
  }, [supplierId, suppliers]);

  const filteredPickupPoints = useMemo(() => {
    return pickupPoints.filter((p) => p.settlementId === settlementId);
  }, [pickupPoints, settlementId]);

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

        <div className="md:col-span-2">
          <SubmitButton>Создать закупку</SubmitButton>
        </div>
      </form>

      <Msg state={state} />
    </div>
  );
}
