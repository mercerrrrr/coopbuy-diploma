"use client";

import { useActionState } from "react";

function Msg({ state }) {
  if (!state?.message) return null;
  const ok = state.ok;

  return (
    <div
      className={[
        "mt-3 rounded-xl border px-3 py-2 text-sm",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900",
      ].join(" ")}
    >
      {state.message}
    </div>
  );
}

function SubmitButton({ children }) {
  return (
    <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
      {children}
    </button>
  );
}

export function CreateSupplierForm({ action }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          name="name"
          placeholder="Название (например: Оптовик-Юг)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <input
          name="minOrderSum"
          placeholder="Мин. сумма заказа (например: 10000)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <input
          name="phone"
          placeholder="Телефон (необязательно)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <input
          name="email"
          placeholder="Email (необязательно)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <div className="md:col-span-2">
          <SubmitButton>Добавить поставщика</SubmitButton>
        </div>
      </form>

      <Msg state={state} />
    </div>
  );
}

export function AddDeliveryZoneForm({ action, supplierId, settlements }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 flex flex-wrap gap-3">
        <input type="hidden" name="supplierId" value={supplierId} />

        <select
          name="settlementId"
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 md:w-105"
          defaultValue=""
        >
          <option value="" disabled>
            Выбери населённый пункт…
          </option>
          {settlements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <SubmitButton>Добавить зону</SubmitButton>
      </form>

      <Msg state={state} />
    </div>
  );
}

export function CreateProductForm({ action, supplierId, categories, units }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="supplierId" value={supplierId} />

        <input
          name="name"
          placeholder="Название товара (например: Гречка 800г)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <select
          name="categoryId"
          defaultValue=""
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        >
          <option value="" disabled>Категория…</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          name="unitId"
          defaultValue=""
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        >
          <option value="" disabled>Единица измерения…</option>
          {(units ?? []).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <input
          name="price"
          placeholder="Цена (целое число, например: 120)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <input
          name="sku"
          placeholder="SKU (необязательно)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <input
          name="imageUrl"
          placeholder="Ссылка на картинку (необязательно)"
          className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />

        <div className="md:col-span-2">
          <SubmitButton>Добавить товар</SubmitButton>
        </div>
      </form>

      <Msg state={state} />
    </div>
  );
}
