"use client";

import { useFormStatus } from "react-dom";
import { CreditCard } from "@phosphor-icons/react";

function SubmitBtn({ label }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--cb-shadow-xs)] hover:bg-[color:var(--cb-accent-strong)] disabled:opacity-60"
    >
      <CreditCard size={16} />
      {pending ? "Перенаправление..." : label}
    </button>
  );
}

export function PaymentButton({ orderId, action, label = "Оплатить онлайн" }) {
  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitBtn label={label} />
    </form>
  );
}
