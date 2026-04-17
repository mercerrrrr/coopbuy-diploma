import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertOperatorOrAdmin } from "@/lib/guards";
import { createCategory, deleteCategory, createUnit, deleteUnit } from "./actions";
import { AddCategoryForm, AddUnitForm, DeleteDictItemButton } from "./ClientForms";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function DictionariesPage() {
  await assertOperatorOrAdmin();
  const [categories, units] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.unit.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ]);

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Справочники"
        title="Категории и единицы измерения"
        description="Базовые справочники для карточек товаров, импорта и отчётных выгрузок."
        actions={
          <Link
            href="/admin/dashboard"
            className="inline-flex min-h-9 items-center rounded-md border border-[color:var(--cb-line)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]"
          >
            К обзору
          </Link>
        }
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Категории товаров</CardTitle>
              <p className="mt-1 text-sm text-[color:var(--cb-text-soft)]">Используются в товарах и импорте.</p>
            </div>
          </CardHeader>
          <CardBody>
            <AddCategoryForm action={createCategory} />

            {categories.length === 0 ? (
              <EmptyState className="px-0" title="Категорий пока нет" />
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--cb-line)] rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div>
                      <span className="font-medium text-[color:var(--cb-text)]">{cat.name}</span>
                      <span className="ml-2 text-xs text-[color:var(--cb-text-faint)]">
                        {cat._count.products} товар(ов)
                      </span>
                    </div>
                    {cat._count.products === 0 && (
                      <DeleteDictItemButton
                        id={cat.id}
                        action={deleteCategory}
                        label={cat.name}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Единицы измерения</CardTitle>
              <p className="mt-1 text-sm text-[color:var(--cb-text-soft)]">Используются в товарах и импорте.</p>
            </div>
          </CardHeader>
          <CardBody>
            <AddUnitForm action={createUnit} />

            {units.length === 0 ? (
              <EmptyState className="px-0" title="Единиц пока нет" />
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--cb-line)] rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]">
                {units.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div>
                      <span className="font-medium text-[color:var(--cb-text)]">{u.name}</span>
                      <span className="ml-2 text-xs text-[color:var(--cb-text-faint)]">
                        {u._count.products} товар(ов)
                      </span>
                    </div>
                    {u._count.products === 0 && (
                      <DeleteDictItemButton
                        id={u.id}
                        action={deleteUnit}
                        label={u.name}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
