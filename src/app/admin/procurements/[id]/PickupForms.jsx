"use client";

import { useRef } from "react";
import { ActionButtonForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";

const inputClassName =
  "rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]";

export function CreatePickupSessionForm({ action, procurementId, pickupWindowStart, pickupWindowEnd }) {
  const toLocal = (dateValue) => {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="procurementId" value={procurementId} />
      <input
        name="startAt"
        type="datetime-local"
        defaultValue={toLocal(pickupWindowStart)}
        className={inputClassName}
      />
      <input
        name="endAt"
        type="datetime-local"
        defaultValue={toLocal(pickupWindowEnd)}
        className={inputClassName}
      />
      <Button type="submit" size="md">
        Создать сессию
      </Button>
    </form>
  );
}

export function CheckinOrderForm({ action, procurementId, sessionId, orderId, participantName }) {
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="procurementId" value={procurementId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="orderId" value={orderId} />
      <Button
        type="submit"
        variant="success"
        size="sm"
        title={`Выдать заказ: ${participantName ?? orderId}`}
      >
        Выдать
      </Button>
    </form>
  );
}

export function ManualCheckinForm({ action, procurementId, sessionId }) {
  const ref = useRef(null);

  return (
    <form
      action={action}
      className="mt-3 flex gap-2"
      onSubmit={() => {
        requestAnimationFrame(() => {
          if (ref.current) ref.current.value = "";
        });
      }}
    >
      <input type="hidden" name="procurementId" value={procurementId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input
        ref={ref}
        name="orderId"
        placeholder="ID заказа или код получения"
        className={`flex-1 font-mono ${inputClassName}`}
        required
      />
      <Button type="submit" size="md">
        Выдать
      </Button>
    </form>
  );
}

export function ClosePickupSessionForm({ action, procurementId, sessionId }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ procurementId, sessionId }}
      label="Закрыть сессию"
      pendingLabel="Закрываем..."
      confirmText="Закрыть сессию выдачи? После этого новые выдачи будут недоступны."
      variant="secondary"
      size="sm"
    />
  );
}
