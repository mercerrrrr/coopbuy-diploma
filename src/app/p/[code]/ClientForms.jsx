"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full justify-center"
    >
      {pending ? "Отправляем..." : "Отправить заявку"}
    </Button>
  );
}

export function SubmitOrderForm({ action, procurementId, code }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div className="mt-4 border-t border-[color:var(--cb-line)] pt-4">
      <div className="text-sm font-medium">Оформить заявку</div>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="procurementId" value={procurementId} />
        <input type="hidden" name="code" value={code} />
        <div className="space-y-1.5">
          <label htmlFor="submit-order-name" className="block text-sm font-medium text-zinc-700">
            Имя участника
          </label>
          <input
            id="submit-order-name"
            name="participantName"
            placeholder="Ваше имя *"
            required
            maxLength={120}
            className="h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="submit-order-phone" className="block text-sm font-medium text-zinc-700">
            Телефон
          </label>
          <input
            id="submit-order-phone"
            name="participantPhone"
            placeholder="Телефон +7XXXXXXXXXX *"
            required
            maxLength={20}
            className="h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]"
          />
        </div>
        <SubmitButton />
      </form>

      {state?.message && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "mt-2 rounded-[0.95rem] border px-3 py-2 text-sm",
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
