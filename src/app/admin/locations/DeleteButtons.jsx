"use client";

export function DeleteRegionButton({ regionId, action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить регион? Это возможно только если внутри нет населённых пунктов.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={regionId} />
      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
        Удалить регион
      </button>
    </form>
  );
}

export function DeleteSettlementButton({ settlementId, action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить населённый пункт? Это возможно только если внутри нет пунктов выдачи.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={settlementId} />
      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-100">
        Удалить НП
      </button>
    </form>
  );
}

export function DeletePickupPointButton({ pickupPointId, action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить пункт выдачи?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={pickupPointId} />
      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
        Удалить
      </button>
    </form>
  );
}
