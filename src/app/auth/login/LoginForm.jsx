"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

const fieldClassName =
  "h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]";

export function LoginForm({ action, next }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-[0.95rem] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
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
          className={fieldClassName}
        />
      </div>

      <div className="grid gap-2">
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
          className={fieldClassName}
        />
      </div>

      <Button type="submit" loading={pending} className="w-full justify-center">
        {pending ? "Проверяем доступ" : "Войти"}
      </Button>
    </form>
  );
}
