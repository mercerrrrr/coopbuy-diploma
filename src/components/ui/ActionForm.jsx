"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";

export function ActionMessage({ state, className = "" }) {
  if (!state?.message) return null;

  return (
    <InlineMessage
      type={state.ok === false ? "error" : "success"}
      className={`mt-2 ${className}`}
    >
      {state.message}
    </InlineMessage>
  );
}

export function ActionButtonForm({
  action,
  hiddenFields = {},
  label,
  pendingLabel = "Сохраняем...",
  confirmText = null,
  variant = "secondary",
  size = "sm",
  buttonClassName = "",
  className = "",
}) {
  const [state, formAction, pending] = useActionState(action, null);

  function handleSubmit(event) {
    if (confirmText && !confirm(confirmText)) {
      event.preventDefault();
    }
  }

  return (
    <div className={className}>
      <form action={formAction} onSubmit={handleSubmit}>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <Button
          type="submit"
          variant={variant}
          size={size}
          loading={pending}
          className={buttonClassName}
        >
          {pending ? pendingLabel : label}
        </Button>
      </form>

      <ActionMessage state={state} />
    </div>
  );
}
