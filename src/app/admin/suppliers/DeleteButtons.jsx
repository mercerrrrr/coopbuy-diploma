"use client";

import { ActionButtonForm } from "@/components/ui/ActionForm";

export function DeleteSupplierButton({ supplierId, action }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id: supplierId }}
      label="Удалить поставщика"
      pendingLabel="Удаляем..."
      confirmText="Удалить поставщика? Если с ним связаны зоны доставки или товары, система остановит операцию."
      variant="secondary"
      size="sm"
      buttonClassName="rounded-xl"
    />
  );
}

export function DeleteZoneButton({ zoneId, action }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id: zoneId }}
      label="Удалить"
      pendingLabel="Удаляем..."
      confirmText="Удалить зону доставки?"
      variant="secondary"
      size="sm"
      buttonClassName="rounded-xl"
    />
  );
}

export function DeleteProductButton({ productId, action }) {
  return (
    <ActionButtonForm
      action={action}
      hiddenFields={{ id: productId }}
      label="Удалить"
      pendingLabel="Удаляем..."
      confirmText="Удалить товар?"
      variant="secondary"
      size="sm"
      buttonClassName="rounded-xl"
    />
  );
}
