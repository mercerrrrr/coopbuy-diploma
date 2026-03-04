"use client";

import { useActionState } from "react";

function Msg({ state }) {
  if (!state?.message) return null;
  return (
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
          className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Добавить
        </button>
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
          className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Добавить
        </button>
      </form>
      <Msg state={state} />
    </div>
  );
}

export function DeleteDictItemButton({ id, action, label = "Удалить" }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        onClick={(e) => {
          if (!confirm(`Удалить "${label}"?`)) e.preventDefault();
        }}
      >
        Удалить
      </button>
    </form>
  );
}
