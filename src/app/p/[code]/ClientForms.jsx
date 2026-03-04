"use client";

import { useActionState } from "react";

export function SubmitOrderForm({ action, procurementId, code }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div className="mt-4 border-t pt-4">
      <div className="text-sm font-medium">Оформить заявку</div>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="procurementId" value={procurementId} />
        <input type="hidden" name="code" value={code} />
        <input
          name="participantName"
          placeholder="Ваше имя *"
          required
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <input
          name="participantPhone"
          placeholder="Телефон +7XXXXXXXXXX *"
          required
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <button className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Отправить заявку
        </button>
      </form>

      {state?.message && (
        <div
          className={[
            "mt-2 rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900",
          ].join(" ")}
        >
          {state.message}
        </div>
      )}
    </div>
  );
}
