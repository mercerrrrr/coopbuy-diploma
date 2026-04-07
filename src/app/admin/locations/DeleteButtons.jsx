"use client";

import { ActionButtonForm } from "@/components/ui/ActionForm";

export function DeleteRegionButton({ regionId, action }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id: regionId }}
      label="Удалить регион"
      pendingLabel="Удаляем..."
      confirmText="Удалить регион? Это возможно только если внутри нет населённых пунктов."
      variant="secondary"
      size="sm"
    />
  );
}

export function DeleteSettlementButton({ settlementId, action }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id: settlementId }}
      label="Удалить НП"
      pendingLabel="Удаляем..."
      confirmText="Удалить населённый пункт? Это возможно только если внутри нет пунктов выдачи."
      variant="secondary"
      size="sm"
    />
  );
}

export function DeletePickupPointButton({ pickupPointId, action }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id: pickupPointId }}
      label="Удалить"
      pendingLabel="Удаляем..."
      confirmText="Удалить пункт выдачи?"
      variant="secondary"
      size="sm"
    />
  );
}
