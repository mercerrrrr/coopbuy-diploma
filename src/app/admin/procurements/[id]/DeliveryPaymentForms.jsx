"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";

const inputClassName =
  "rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]";

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
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="delivery-fee" className="mb-1 block text-xs text-[color:var(--cb-text-faint)]">
            Стоимость доставки, ₽
          </label>
          <input
            id="delivery-fee"
            type="number"
            name="deliveryFee"
            defaultValue={deliveryFee}
            min="0"
            className={`w-32 ${inputClassName}`}
          />
        </div>
        <div>
          <label
            htmlFor="delivery-split-mode"
            className="mb-1 block text-xs text-[color:var(--cb-text-faint)]"
          >
            Режим распределения
          </label>
          <select
            id="delivery-split-mode"
            name="deliverySplitMode"
            defaultValue={deliverySplitMode}
            className={inputClassName}
          >
            <option value="PROPORTIONAL_SUM">Пропорционально сумме</option>
            <option value="EQUAL">Поровну</option>
            <option value="PER_ITEM">По количеству товаров</option>
          </select>
        </div>
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? "Сохраняем..." : "Сохранить и пересчитать"}
        </Button>
      </div>
      {state?.error && (
        <InlineMessage type="error" className="mt-3">
          {state.error}
        </InlineMessage>
      )}
      {state?.ok && (
        <InlineMessage type="success" className="mt-3">
          {state.message}
        </InlineMessage>
      )}
    </form>
  );
}
