import Link from "next/link";
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
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2, MapPin, Package, ExternalLink } from "lucide-react";

export default async function SuppliersPage() {
  const [settlementsRaw, suppliers, categories, units] = await Promise.all([
    prisma.settlement.findMany({
      orderBy: [{ name: "asc" }],
      include: { region: true },
    }),
    prisma.supplier.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        zones: {
          orderBy: [{ createdAt: "desc" }],
          include: { settlement: { include: { region: true } } },
        },
        products: {
          orderBy: [{ createdAt: "desc" }],
          include: { category: true, unit: true },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);

  const settlements = settlementsRaw.map((s) => ({
    id: s.id,
    label: `${s.region.name} • ${s.name}`,
  }));

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1.5">
          <Building2 size={13} />
          <span>Поставщики</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Поставщики</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Ассортимент, зоны доставки и минимальные суммы заказа
        </p>
      </div>

      {/* Add supplier form */}
      <Card>
        <CardHeader>
          <CardTitle>Добавить поставщика</CardTitle>
        </CardHeader>
        <CardBody>
          <CreateSupplierForm action={createSupplier} />
        </CardBody>
      </Card>

      {/* Supplier list */}
      {suppliers.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<Building2 size={36} />}
            title="Поставщиков пока нет"
            description="Добавьте первого поставщика с помощью формы выше"
          />
        </div>
      )}

      <div className="space-y-4">
        {suppliers.map((sp) => (
          <Card key={sp.id}>
            {/* Supplier header */}
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-zinc-900">{sp.name}</h2>
                <Badge variant={sp.isActive ? "success" : "neutral"}>
                  {sp.isActive ? "активен" : "выключен"}
                </Badge>
                <span className="text-sm text-zinc-500">
                  Мин. сумма: <span className="font-medium text-zinc-700">{sp.minOrderSum} ₽</span>
                </span>
                {sp.phone && <span className="text-sm text-zinc-500">{sp.phone}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/suppliers/${sp.id}/import`}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <ExternalLink size={12} />
                  Импорт CSV
                </Link>
                <form action={toggleSupplierActive}>
                  <input type="hidden" name="id" value={sp.id} />
                  <input type="hidden" name="current" value={String(sp.isActive)} />
                  <button className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
                    {sp.isActive ? "Выключить" : "Включить"}
                  </button>
                </form>
                <DeleteSupplierButton supplierId={sp.id} action={deleteSupplier} />
              </div>
            </CardHeader>

            <CardBody className="space-y-4">
              {/* Delivery zones */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 mb-2">
                  <MapPin size={14} className="text-zinc-400" />
                  Зоны доставки
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                  <AddDeliveryZoneForm
                    action={addDeliveryZone}
                    supplierId={sp.id}
                    settlements={settlements}
                  />
                  {sp.zones.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-2 text-center">Зон доставки нет</p>
                  ) : (
                    <ul className="space-y-2">
                      {sp.zones.map((z) => (
                        <li
                          key={z.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
                        >
                          <div>
                            <span className="text-sm font-medium text-zinc-800">
                              {z.settlement.region.name} · {z.settlement.name}
                            </span>
                            <span className="ml-2">
                              <Badge variant={z.isActive ? "success" : "neutral"}>
                                {z.isActive ? "активно" : "выключено"}
                              </Badge>
                            </span>
                          </div>
                          <DeleteZoneButton zoneId={z.id} action={deleteDeliveryZone} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Products */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 mb-2">
                  <Package size={14} className="text-zinc-400" />
                  Товары
                  <span className="text-xs text-zinc-400">({sp.products.length})</span>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                  <CreateProductForm
                    action={createProduct}
                    supplierId={sp.id}
                    categories={categories}
                    units={units}
                  />
                  {sp.products.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-2 text-center">Товаров нет</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                            <th className="px-3 py-2.5 font-medium">Наименование</th>
                            <th className="px-3 py-2.5 font-medium">Категория</th>
                            <th className="px-3 py-2.5 font-medium">Ед.</th>
                            <th className="px-3 py-2.5 font-medium text-right">Цена, ₽</th>
                            <th className="px-3 py-2.5 font-medium">SKU</th>
                            <th className="px-3 py-2.5 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {sp.products.map((p, idx) => (
                            <tr
                              key={p.id}
                              className={[
                                "border-b last:border-0 transition-colors",
                                idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40",
                                "hover:bg-indigo-50/20",
                              ].join(" ")}
                            >
                              <td className="px-3 py-2.5 font-medium text-zinc-900">{p.name}</td>
                              <td className="px-3 py-2.5 text-zinc-500">{p.category.name}</td>
                              <td className="px-3 py-2.5 text-zinc-500">{p.unit.name}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-zinc-900">
                                {p.price}
                              </td>
                              <td className="px-3 py-2.5 text-zinc-400 font-mono text-xs">
                                {p.sku ?? "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <DeleteProductButton productId={p.id} action={deleteProduct} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
