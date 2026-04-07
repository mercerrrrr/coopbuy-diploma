"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

const fieldClassName =
  "h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]";

export function RegisterForm({ action, settlements, next }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [settlementQuery, setSettlementQuery] = useState("");

  const filteredSettlements = useMemo(() => {
    const query = settlementQuery.trim().toLowerCase();
    if (!query) return settlements;

    return settlements.filter((settlement) => {
      const haystack = `${settlement.name} ${settlement.region.name}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [settlementQuery, settlements]);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

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
        <label htmlFor="register-full-name" className="text-sm font-medium text-[color:var(--cb-text)]">
          Полное имя
        </label>
        <input
          id="register-full-name"
          name="fullName"
          placeholder="Имя и фамилия"
          required
          autoComplete="name"
          maxLength={120}
          className={fieldClassName}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="register-email" className="text-sm font-medium text-[color:var(--cb-text)]">
            Email
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            placeholder="name@domain.ru"
            required
            autoComplete="email"
            className={fieldClassName}
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="register-phone" className="text-sm font-medium text-[color:var(--cb-text)]">
            Телефон
          </label>
          <input
            id="register-phone"
            name="phone"
            type="tel"
            placeholder="+7 900 000-00-00"
            autoComplete="tel"
            maxLength={20}
            className={fieldClassName}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="register-password" className="text-sm font-medium text-[color:var(--cb-text)]">
          Пароль
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          placeholder="Минимум 8 символов"
          required
          autoComplete="new-password"
          className={fieldClassName}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="register-settlement" className="text-sm font-medium text-[color:var(--cb-text)]">
          Населённый пункт
        </label>
        <input
          type="search"
          value={settlementQuery}
          onChange={(e) => setSettlementQuery(e.target.value)}
          placeholder="Поиск по населённому пункту"
          className={fieldClassName}
        />
        <select
          id="register-settlement"
          name="settlementId"
          required
          defaultValue=""
          className={fieldClassName}
        >
          <option value="" disabled>
            Выберите населённый пункт
          </option>
          {filteredSettlements.map((settlement) => (
            <option key={settlement.id} value={settlement.id}>
              {settlement.name} {settlement.region.name ? `· ${settlement.region.name}` : ""}
            </option>
          ))}
        </select>
        <div className="text-xs text-[color:var(--cb-text-faint)]">
          Сначала выберите населённый пункт. Регион указан только для уточнения.
        </div>
      </div>

      <Button type="submit" loading={pending} className="w-full justify-center">
        {pending ? "Создаём профиль" : "Зарегистрироваться"}
      </Button>
    </form>
  );
}
