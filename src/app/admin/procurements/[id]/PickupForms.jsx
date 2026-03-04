"use client";

import { useRef } from "react";

export function CreatePickupSessionForm({ action, procurementId, pickupWindowStart, pickupWindowEnd }) {
  const toLocal = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="procurementId" value={procurementId} />
      <input
        name="startAt"
        type="datetime-local"
        defaultValue={toLocal(pickupWindowStart)}
        className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <input
        name="endAt"
        type="datetime-local"
        defaultValue={toLocal(pickupWindowEnd)}
        className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
        Создать сессию
      </button>
    </form>
  );
}

export function CheckinOrderForm({ action, procurementId, sessionId, orderId, participantName }) {
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="procurementId" value={procurementId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="orderId" value={orderId} />
      <button
        title={`Выдать заказ: ${participantName ?? orderId}`}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        Выдать
      </button>
    </form>
  );
}

export function ManualCheckinForm({ action, procurementId, sessionId }) {
  const ref = useRef(null);
  return (
    <form
      action={action}
      className="mt-3 flex gap-2"
      onSubmit={() => { if (ref.current) ref.current.value = ""; }}
    >
      <input type="hidden" name="procurementId" value={procurementId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input
        ref={ref}
        name="orderId"
        placeholder="ID заявки (из QR-кода)"
        className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 font-mono"
        required
      />
      <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
        Выдать
      </button>
    </form>
  );
}

export function ClosePickupSessionForm({ action, procurementId, sessionId }) {
  return (
    <form action={action}>
      <input type="hidden" name="procurementId" value={procurementId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <button className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100">
        Закрыть сессию
      </button>
    </form>
  );
}
