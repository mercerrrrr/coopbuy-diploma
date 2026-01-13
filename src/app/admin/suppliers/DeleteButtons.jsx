"use client";

export function DeleteSupplierButton({ supplierId, action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить поставщика? Удалятся зоны доставки и товары (если они есть — может быть запрещено).")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={supplierId} />
      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
        Удалить поставщика
      </button>
    </form>
  );
}

export function DeleteZoneButton({ zoneId, action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить зону доставки?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={zoneId} />
      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
        Удалить
      </button>
    </form>
  );
}

export function DeleteProductButton({ productId, action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить товар?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={productId} />
      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
        Удалить
      </button>
    </form>
  );
}
