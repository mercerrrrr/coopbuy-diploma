"use client";

import { useActionState } from "react";

export function RegisterForm({ action, settlements, next }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <input
        name="fullName"
        placeholder="Полное имя"
        required
        autoComplete="name"
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        autoComplete="email"
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <input
        name="phone"
        type="tel"
        placeholder="Телефон (необязательно)"
        autoComplete="tel"
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <input
        name="password"
        type="password"
        placeholder="Пароль (мин. 8 символов)"
        required
        autoComplete="new-password"
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Населённый пункт *</label>
        <select
          name="settlementId"
          required
          defaultValue=""
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        >
          <option value="" disabled>Выберите…</option>
          {settlements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.region.name} — {s.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Регистрация…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
