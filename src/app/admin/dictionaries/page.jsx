import Link from "next/link";
import { prisma } from "@/lib/db";
import { createCategory, deleteCategory, createUnit, deleteUnit } from "./actions";
import { AddCategoryForm, AddUnitForm, DeleteDictItemButton } from "./ClientForms";

export default async function DictionariesPage() {
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
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Главная
        </Link>
        <span className="text-zinc-300">|</span>
        <h1 className="text-2xl font-semibold tracking-tight">Справочники</h1>
      </div>

      {/* Categories */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Категории товаров</div>
        <p className="mt-1 text-xs text-zinc-500">
          Используются при создании товара и импорте прайс-листа.
        </p>

        <AddCategoryForm action={createCategory} />

        <ul className="mt-4 space-y-2">
          {categories.length === 0 ? (
            <li className="text-sm text-zinc-500">Пока нет категорий.</li>
          ) : (
            categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between rounded-xl border bg-zinc-50 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{cat.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">
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
            ))
          )}
        </ul>
      </section>

      {/* Units */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Единицы измерения</div>
        <p className="mt-1 text-xs text-zinc-500">
          Используются при создании товара и импорте прайс-листа.
        </p>

        <AddUnitForm action={createUnit} />

        <ul className="mt-4 space-y-2">
          {units.length === 0 ? (
            <li className="text-sm text-zinc-500">Пока нет единиц измерения.</li>
          ) : (
            units.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-xl border bg-zinc-50 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{u.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">
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
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
