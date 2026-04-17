"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

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
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

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
          className="cb-input-enhanced"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2.5">
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
            className="cb-input-enhanced"
          />
        </div>

        <div className="grid gap-2.5">
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
            className="cb-input-enhanced"
          />
        </div>
      </div>

      <div className="grid gap-2.5">
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
          className="cb-input-enhanced"
        />
      </div>

      <div className="grid gap-2.5">
        <label htmlFor="register-settlement" className="text-sm font-medium text-[color:var(--cb-text)]">
          Населённый пункт
        </label>
        <input
          type="search"
          value={settlementQuery}
          onChange={(e) => setSettlementQuery(e.target.value)}
          placeholder="Поиск по населённому пункту"
          className="cb-input-enhanced"
        />
        <select
          id="register-settlement"
          name="settlementId"
          required
          defaultValue=""
          className="cb-input-enhanced"
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
          Выберите населённый пункт, к которому будут привязаны ваши закупки.
        </div>
      </div>

      <Button type="submit" loading={pending} size="lg" className="w-full justify-center">
        {pending ? "Создаём профиль" : "Зарегистрироваться"}
      </Button>
    </form>
  );
}
