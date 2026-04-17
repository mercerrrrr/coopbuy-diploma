import Link from "next/link";
import { ArrowSquareOut, Buildings, MapPin, Package } from "@phosphor-icons/react/ssr";
import { prisma } from "@/lib/db";
import { assertOperatorOrAdmin } from "@/lib/guards";
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
import { ActionButtonForm } from "@/components/ui/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function SuppliersPage() {
  const session = await assertOperatorOrAdmin();
  const isAdmin = session.role === "ADMIN";
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

  const settlements = settlementsRaw.map((settlement) => ({
    id: settlement.id,
    label: `${settlement.region.name} • ${settlement.name}`,
  }));

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Операционный центр / поставщики"
        title="Поставщики и их ассортимент"
        description="Управляйте карточками поставщиков, зонами доставки и товарными позициями в одном справочнике."
        meta={
          <div className="rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3">
            <div className="cb-kicker">Всего поставщиков</div>
            <div className="mt-1.5 text-xl font-semibold text-[color:var(--cb-text)]">
              {suppliers.length}
            </div>
          </div>
        }
      />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Добавить поставщика</CardTitle>
          </CardHeader>
          <CardBody>
            <CreateSupplierForm action={createSupplier} />
          </CardBody>
        </Card>
      )}

      {suppliers.length === 0 && (
        <div className="cb-panel-strong rounded-[1.1rem]">
          <EmptyState
            icon={<Buildings size={36} weight="duotone" />}
            title="Поставщиков пока нет"
            description="Создайте первую карточку поставщика, чтобы подключить ассортимент и зоны доставки."
          />
        </div>
      )}

      <div className="space-y-4">
        {suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <CardHeader className="items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[color:var(--cb-text)]">{supplier.name}</h2>
                  <Badge variant={supplier.isActive ? "success" : "neutral"}>
                    {supplier.isActive ? "Активен" : "Отключён"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-[color:var(--cb-text-soft)]">
                  <span>
                    Мин. сумма заказа:{" "}
                    <span className="font-medium text-[color:var(--cb-text)]">
                      {supplier.minOrderSum.toLocaleString("ru-RU")} ₽
                    </span>
                  </span>
                  <span>
                    Доставка:{" "}
                    <span className="font-medium text-[color:var(--cb-text)]">
                      {supplier.deliveryFee > 0
                        ? `${supplier.deliveryFee.toLocaleString("ru-RU")} ₽`
                        : "бесплатно"}
                    </span>
                  </span>
                </div>
                {(supplier.phone || supplier.email) && (
                  <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                    {[supplier.phone, supplier.email].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/suppliers/${supplier.id}/import`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]"
                >
                  <ArrowSquareOut size={14} />
                  Импорт CSV
                </Link>
                {isAdmin && (
                  <ActionButtonForm
                    action={toggleSupplierActive}
                    hiddenFields={{ id: supplier.id }}
                    label={supplier.isActive ? "Отключить" : "Включить"}
                    pendingLabel="Сохраняем..."
                    size="sm"
                  />
                )}
                {isAdmin && <DeleteSupplierButton supplierId={supplier.id} action={deleteSupplier} />}
              </div>
            </CardHeader>

            <CardBody className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
                <div className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[color:var(--cb-text)]">
                    <MapPin size={16} className="text-[color:var(--cb-accent)]" />
                    Зоны доставки
                  </div>

                  {isAdmin && (
                    <AddDeliveryZoneForm
                      action={addDeliveryZone}
                      supplierId={supplier.id}
                      settlements={settlements}
                    />
                  )}

                  {supplier.zones.length === 0 ? (
                    <p className="py-3 text-center text-sm text-[color:var(--cb-text-faint)]">
                      Зоны доставки ещё не добавлены.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {supplier.zones.map((zone) => (
                        <li
                          key={zone.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--cb-line)] bg-white px-3 py-2.5"
                        >
                          <div>
                            <span className="text-sm font-medium text-[color:var(--cb-text)]">
                              {zone.settlement.region.name} · {zone.settlement.name}
                            </span>
                            <span className="ml-2">
                              <Badge variant={zone.isActive ? "success" : "neutral"}>
                                {zone.isActive ? "Доступна" : "Отключена"}
                              </Badge>
                            </span>
                          </div>
                          {isAdmin && <DeleteZoneButton zoneId={zone.id} action={deleteDeliveryZone} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[color:var(--cb-text)]">
                    <Package size={16} className="text-[color:var(--cb-accent)]" />
                    Товарные позиции
                    <span className="text-xs text-[color:var(--cb-text-faint)]">
                      ({supplier.products.length})
                    </span>
                  </div>

                  {isAdmin && (
                    <CreateProductForm
                      action={createProduct}
                      supplierId={supplier.id}
                      categories={categories}
                      units={units}
                    />
                  )}

                  {supplier.products.length === 0 ? (
                    <p className="py-3 text-center text-sm text-[color:var(--cb-text-faint)]">
                      Товары ещё не добавлены.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--cb-line)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[color:var(--cb-line)] bg-white/72 text-left text-xs text-[color:var(--cb-text-faint)]">
                            <th className="px-3 py-2.5 font-medium">Наименование</th>
                            <th className="px-3 py-2.5 font-medium">Категория</th>
                            <th className="px-3 py-2.5 font-medium">Ед.</th>
                            <th className="px-3 py-2.5 text-right font-medium">Цена, ₽</th>
                            <th className="px-3 py-2.5 font-medium">SKU</th>
                            {isAdmin && <th className="px-3 py-2.5 font-medium" />}
                          </tr>
                        </thead>
                        <tbody>
                          {supplier.products.map((product, index) => (
                            <tr
                              key={product.id}
                              className={[
                                "border-b border-[color:var(--cb-line)] last:border-b-0",
                                index % 2 === 0 ? "bg-white" : "bg-[color:var(--cb-bg-soft)]",
                              ].join(" ")}
                            >
                              <td className="px-3 py-2.5 font-medium text-[color:var(--cb-text)]">{product.name}</td>
                              <td className="px-3 py-2.5 text-[color:var(--cb-text-soft)]">{product.category.name}</td>
                              <td className="px-3 py-2.5 text-[color:var(--cb-text-soft)]">{product.unit.name}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-[color:var(--cb-text)]">
                                {product.price}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-[color:var(--cb-text-faint)]">
                                {product.sku ?? "—"}
                              </td>
                              {isAdmin && (
                                <td className="px-3 py-2.5">
                                  <DeleteProductButton productId={product.id} action={deleteProduct} />
                                </td>
                              )}
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
