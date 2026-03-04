"use client";

import { useActionState } from "react";

export function LoginForm({ action, next }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      {state?.error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        autoComplete="email"
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <input
        name="password"
        type="password"
        placeholder="Пароль"
        required
        autoComplete="current-password"
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
