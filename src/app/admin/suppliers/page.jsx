import { prisma } from "@/lib/db";

import {
  createSupplier,
  toggleSupplierActive,
  deleteSupplier,
  addDeliveryZone,
  deleteDeliveryZone,
  createProduct,
  deleteProduct,
} from "./actions";

import { CreateSupplierForm, AddDeliveryZoneForm, CreateProductForm } from "./ClientForms";
import { DeleteSupplierButton, DeleteZoneButton, DeleteProductButton } from "./DeleteButtons";

export default async function SuppliersPage() {
  const settlementsRaw = await prisma.settlement.findMany({
    orderBy: [{ name: "asc" }],
    include: { region: true },
  });

  const settlements = settlementsRaw.map((s) => ({
    id: s.id,
    label: `${s.region.name} • ${s.name}`,
  }));

  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      zones: {
        orderBy: [{ createdAt: "desc" }],
        include: { settlement: { include: { region: true } } },
      },
      products: {
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Поставщики</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Поставщик — это сущность в системе: ассортимент + минимальная сумма + зоны доставки по населённым пунктам.
      </p>

      {/* Создать поставщика */}
      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-medium">Добавить поставщика</div>
        <CreateSupplierForm action={createSupplier} />
      </section>

      <div className="mt-6 space-y-4">
        {suppliers.map((sp) => (
          <section key={sp.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium">{sp.name}</h2>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs border",
                      sp.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-zinc-50 text-zinc-600",
                    ].join(" ")}
                  >
                    {sp.isActive ? "активен" : "выключен"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Мин. сумма: <span className="font-medium">{sp.minOrderSum} ₽</span>
                  {sp.phone ? <span> • {sp.phone}</span> : null}
                  {sp.email ? <span> • {sp.email}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <form action={toggleSupplierActive}>
                  <input type="hidden" name="id" value={sp.id} />
                  <input type="hidden" name="current" value={String(sp.isActive)} />
                  <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                    {sp.isActive ? "Выключить" : "Включить"}
                  </button>
                </form>

                <DeleteSupplierButton supplierId={sp.id} action={deleteSupplier} />
              </div>
            </div>

            {/* Зоны доставки */}
            <div className="mt-4 rounded-xl border bg-zinc-50 p-4">
              <div className="text-sm font-medium">Зоны доставки</div>
              <AddDeliveryZoneForm action={addDeliveryZone} supplierId={sp.id} settlements={settlements} />

              <ul className="mt-3 space-y-2">
                {sp.zones.length === 0 ? (
                  <li className="text-sm text-zinc-600">Пока нет зон доставки.</li>
                ) : (
                  sp.zones.map((z) => (
                    <li key={z.id} className="rounded-xl border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm">
                          <div className="font-medium">
                            {z.settlement.region.name} • {z.settlement.name}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {z.isActive ? "активно" : "выключено"}
                          </div>
                        </div>

                        <DeleteZoneButton zoneId={z.id} action={deleteDeliveryZone} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Товары */}
            <div className="mt-4 rounded-xl border bg-zinc-50 p-4">
              <div className="text-sm font-medium">Товары</div>
              <CreateProductForm action={createProduct} supplierId={sp.id} />

              <ul className="mt-3 space-y-2">
                {sp.products.length === 0 ? (
                  <li className="text-sm text-zinc-600">Пока нет товаров.</li>
                ) : (
                  sp.products.map((p) => (
                    <li key={p.id} className="rounded-xl border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="mt-1 text-sm text-zinc-600">
                            {p.category} • {p.unit} • <span className="font-medium">{p.price} ₽</span>
                            {p.sku ? <span> • SKU: {p.sku}</span> : null}
                          </div>
                        </div>

                        <DeleteProductButton productId={p.id} action={deleteProduct} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
