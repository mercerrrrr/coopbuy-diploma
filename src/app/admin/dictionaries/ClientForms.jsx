"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { ActionButtonForm } from "@/components/ui/ActionForm";

function Msg({ state }) {
  if (!state?.message) return null;
  return (
    <div
      className={[
        "mt-2 rounded-[0.95rem] border px-3 py-2 text-sm",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900",
      ].join(" ")}
    >
      {state.message}
    </div>
  );
}

export function AddCategoryForm({ action }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <div>
      <form action={formAction} className="mt-3 flex gap-3">
        <input
          name="name"
          placeholder="Название категории…"
          className="h-10 flex-1 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]"
        />
        <Button type="submit" size="md">
          Добавить
        </Button>
      </form>
      <Msg state={state} />
    </div>
  );
}

export function AddUnitForm({ action }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <div>
      <form action={formAction} className="mt-3 flex gap-3">
        <input
          name="name"
          placeholder="Единица измерения (шт, кг, л…)"
          className="h-10 flex-1 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]"
        />
        <Button type="submit" size="md">
          Добавить
        </Button>
      </form>
      <Msg state={state} />
    </div>
  );
}

export function DeleteDictItemButton({ id, action, label = "Удалить" }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id }}
      label="Удалить"
      pendingLabel="Удаляем..."
      confirmText={`Удалить "${label}"?`}
      variant="secondary"
      size="sm"
      buttonClassName="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
    />
  );
}
