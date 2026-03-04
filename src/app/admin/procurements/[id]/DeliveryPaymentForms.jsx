"use client";

import { useActionState } from "react";

export function DeliverySettingsForm({
  action,
  procurementId,
  deliveryFee,
  deliverySplitMode,
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="procurementId" value={procurementId} />
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Стоимость доставки, ₽
          </label>
          <input
            type="number"
            name="deliveryFee"
            defaultValue={deliveryFee}
            min="0"
            className="rounded-xl border bg-white px-3 py-2 text-sm w-32 outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Режим разделения
          </label>
          <select
            name="deliverySplitMode"
            defaultValue={deliverySplitMode}
            className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
          >
            <option value="PROPORTIONAL_SUM">Пропорционально сумме</option>
            <option value="EQUAL">Поровну</option>
            <option value="PER_ITEM">Пропорционально кол-ву товаров</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isPending ? "Сохраняем..." : "Сохранить и пересчитать"}
        </button>
      </div>
      {state?.error && (
        <div className="mt-2 text-sm text-red-600">{state.error}</div>
      )}
      {state?.ok && (
        <div className="mt-2 text-sm text-emerald-600">{state.message}</div>
      )}
    </form>
  );
}
