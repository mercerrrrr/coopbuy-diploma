"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm({ action, next }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-2.5">
        <label htmlFor="login-email" className="text-sm font-medium text-[color:var(--cb-text)]">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="name@domain.ru"
          required
          autoComplete="email"
          className="cb-input-enhanced"
        />
      </div>

      <div className="grid gap-2.5">
        <label htmlFor="login-password" className="text-sm font-medium text-[color:var(--cb-text)]">
          Пароль
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          placeholder="Минимум 8 символов"
          required
          autoComplete="current-password"
          className="cb-input-enhanced"
        />
      </div>

      <Button type="submit" loading={pending} size="lg" className="w-full justify-center">
        {pending ? "Проверяем доступ" : "Войти"}
      </Button>
    </form>
  );
}
