"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

function SubmitButton({ children }) {
  return (
    <Button type="submit" size="md">
      {children}
    </Button>
  );
}

function Msg({ state }) {
  if (!state?.message) return null;

  const ok = state.ok;
  return (
    <div
      className={[
        "mt-3 rounded-[0.95rem] border px-3 py-2 text-sm",
        ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
      ].join(" ")}
    >
      {state.message}
    </div>
  );
}

export function CreateRegionForm({ action }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 flex flex-wrap gap-3">
        <input
          name="name"
          placeholder="Например: Астраханская область"
          className="h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)] md:w-105"
        />
        <SubmitButton>Добавить</SubmitButton>
      </form>
      <Msg state={state} />
    </div>
  );
}

export function CreateSettlementForm({ action, regionId }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 flex flex-wrap gap-3">
        <input type="hidden" name="regionId" value={regionId} />
        <input
          name="name"
          placeholder="Например: Новолесное"
          className="h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)] md:w-[320px]"
        />
        <SubmitButton>Добавить</SubmitButton>
      </form>
      <Msg state={state} />
    </div>
  );
}

export function CreatePickupPointForm({ action, settlementId }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="settlementId" value={settlementId} />

        <input
          name="name"
          placeholder="Название (например: Пункт выдачи №1)"
          className="h-10 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]"
        />

        <input
          name="address"
          placeholder="Адрес (например: Центральная улица, дом 1)"
          className="h-10 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]"
        />

        <label className="flex min-h-10 items-center gap-2 rounded-md border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3 text-sm text-[color:var(--cb-text-soft)]">
          <input type="checkbox" name="hasFreezer" className="h-4 w-4" />
          Есть морозилка
        </label>

        <div className="md:col-span-2">
          <SubmitButton>Добавить пункт</SubmitButton>
        </div>
      </form>

      <Msg state={state} />
    </div>
  );
}
