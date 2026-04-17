"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

function SubmitButton({ payMethod }) {
  const { pending } = useFormStatus();
  const label = payMethod === "online"
    ? (pending ? "Перенаправление на оплату..." : "Оплатить и отправить")
    : (pending ? "Отправляем..." : "Отправить заявку");
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full justify-center"
    >
      {label}
    </Button>
  );
}

export function SubmitOrderForm({ action, procurementId, code }) {
  const [state, formAction] = useActionState(action, null);
  const [payMethod, setPayMethod] = useState("online");

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

        <fieldset className="space-y-1.5">
          <legend className="block text-sm font-medium text-zinc-700">Способ оплаты</legend>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${payMethod === "online" ? "border-[color:rgba(var(--cb-accent-rgb),0.34)] bg-[color:var(--cb-accent-soft)]" : "border-[color:var(--cb-line-strong)] bg-white"}`}>
            <input
              type="radio"
              name="payMethod"
              value="online"
              checked={payMethod === "online"}
              onChange={() => setPayMethod("online")}
              className="accent-[color:var(--cb-accent)]"
            />
            <div>
              <div className="font-medium text-[color:var(--cb-text)]">Оплатить онлайн</div>
              <div className="text-xs text-[color:var(--cb-text-soft)]">Карта / СБП / ЮMoney</div>
            </div>
          </label>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${payMethod === "pickup" ? "border-[color:rgba(var(--cb-accent-rgb),0.34)] bg-[color:var(--cb-accent-soft)]" : "border-[color:var(--cb-line-strong)] bg-white"}`}>
            <input
              type="radio"
              name="payMethod"
              value="pickup"
              checked={payMethod === "pickup"}
              onChange={() => setPayMethod("pickup")}
              className="accent-[color:var(--cb-accent)]"
            />
            <div>
              <div className="font-medium text-[color:var(--cb-text)]">Оплата при получении</div>
              <div className="text-xs text-[color:var(--cb-text-soft)]">Наличные или перевод в пункте выдачи</div>
            </div>
          </label>
        </fieldset>

        <SubmitButton payMethod={payMethod} />
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
