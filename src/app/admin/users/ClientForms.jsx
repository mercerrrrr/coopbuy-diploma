"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";

const inputClassName =
  "h-10 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]";

function Field({ label, htmlFor, error, hint = null, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[color:var(--cb-text)]">
        {label}
      </label>
      {children}
      {hint && !error && <div className="text-xs text-[color:var(--cb-text-faint)]">{hint}</div>}
      {error && (
        <div className="text-sm text-rose-700" role="status" aria-live="polite">
          {error}
        </div>
      )}
    </div>
  );
}

function Message({ state }) {
  if (!state?.message) return null;

  return (
    <InlineMessage type={state.ok ? "success" : "error"} className="mt-3">
      {state.message}
    </InlineMessage>
  );
}

function SubmitButton({ idleLabel, pendingLabel }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

export function CreateOperatorForm({ action, pickupPoints }) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <div>
      <form ref={formRef} action={formAction} className="grid gap-3 md:grid-cols-2">
        <Field label="Полное имя" htmlFor="operator-full-name" error={state?.fieldErrors?.fullName}>
          <input id="operator-full-name" name="fullName" maxLength={120} className={inputClassName} />
        </Field>

        <Field label="Email" htmlFor="operator-email" error={state?.fieldErrors?.email}>
          <input id="operator-email" name="email" type="email" autoComplete="email" className={inputClassName} />
        </Field>

        <Field
          label="Пароль"
          htmlFor="operator-password"
          error={state?.fieldErrors?.password}
          hint="Минимум 8 символов"
        >
          <input
            id="operator-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={inputClassName}
          />
        </Field>

        <Field
          label="Пункт выдачи"
          htmlFor="operator-pickup-point"
          error={state?.fieldErrors?.pickupPointId}
          hint="Населённый пункт будет определён автоматически по выбранному ПВЗ."
        >
          <select
            id="operator-pickup-point"
            name="pickupPointId"
            defaultValue=""
            className={inputClassName}
          >
            <option value="" disabled>
              Выберите пункт выдачи
            </option>
            {pickupPoints.map((pickupPoint) => (
              <option key={pickupPoint.id} value={pickupPoint.id}>
                {pickupPoint.name} · {pickupPoint.settlement.name}
                {pickupPoint.settlement.region?.name ? ` · ${pickupPoint.settlement.region.name}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2">
          <SubmitButton idleLabel="Создать оператора" pendingLabel="Создаём оператора..." />
        </div>
      </form>

      <Message state={state} />
    </div>
  );
}

export function CreateResidentForm({ action, settlements }) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <div>
      <form ref={formRef} action={formAction} className="grid gap-3 md:grid-cols-2">
        <Field label="Полное имя" htmlFor="resident-full-name" error={state?.fieldErrors?.fullName}>
          <input id="resident-full-name" name="fullName" maxLength={120} className={inputClassName} />
        </Field>

        <Field label="Email" htmlFor="resident-email" error={state?.fieldErrors?.email}>
          <input id="resident-email" name="email" type="email" autoComplete="email" className={inputClassName} />
        </Field>

        <Field
          label="Пароль"
          htmlFor="resident-password"
          error={state?.fieldErrors?.password}
          hint="Минимум 8 символов"
        >
          <input
            id="resident-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={inputClassName}
          />
        </Field>

        <Field
          label="Телефон"
          htmlFor="resident-phone"
          error={state?.fieldErrors?.phone}
          hint="Необязательно"
        >
          <input id="resident-phone" name="phone" type="tel" maxLength={20} className={inputClassName} />
        </Field>

        <div className="md:col-span-2">
          <Field
            label="Населённый пункт"
            htmlFor="resident-settlement"
            error={state?.fieldErrors?.settlementId}
          >
            <select
              id="resident-settlement"
              name="settlementId"
              defaultValue=""
              className={`${inputClassName} w-full`}
            >
              <option value="" disabled>
                Выберите населённый пункт
              </option>
              {settlements.map((settlement) => (
                <option key={settlement.id} value={settlement.id}>
                  {settlement.name}
                  {settlement.region?.name ? ` · ${settlement.region.name}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="md:col-span-2">
          <SubmitButton idleLabel="Создать жителя" pendingLabel="Создаём жителя..." />
        </div>
      </form>

      <Message state={state} />
    </div>
  );
}
