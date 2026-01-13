import { prisma } from "@/lib/db";
import { addToCart } from "./actions";

export default async function PublicProcurementPage({ params }) {
  const code = params.code;

  const procurement = await prisma.procurement.findUnique({
    where: { inviteCode: code },
    include: {
      supplier: true,
      pickupPoint: true,
      settlement: { include: { region: true } },
      orders: {
        where: { status: "DRAFT", participantName: null, participantPhone: null },
        include: { items: { include: { product: true } } },
      },
    },
  });

  if (!procurement) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Закупка не найдена</h1>
          <p className="mt-2 text-sm text-zinc-600">Проверь ссылку или попроси у организатора новую.</p>
        </div>
      </main>
    );
  }

  const products = await prisma.product.findMany({
    where: { supplierId: procurement.supplierId, isActive: true },
    orderBy: [{ createdAt: "desc" }],
  });

  const cart = procurement.orders[0] ?? null;
  const cartItems = cart?.items ?? [];

  const cartTotal = cartItems.reduce((sum, it) => sum + it.qty * it.price, 0);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{procurement.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Поставщик: <span className="font-medium">{procurement.supplier.name}</span>
          {" • "}
          {procurement.settlement.region.name} • {procurement.settlement.name}
          {" • "}
          Пункт выдачи: <span className="font-medium">{procurement.pickupPoint.name}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Дедлайн: {new Date(procurement.deadlineAt).toLocaleString("ru-RU")} • Мин. сбор:{" "}
          {procurement.minTotalSum} ₽
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Товары */}
        <section className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-medium">Каталог</div>
          <ul className="mt-3 space-y-3">
            {products.map((p) => (
              <li key={p.id} className="rounded-xl border bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {p.category} • {p.unit} • <span className="font-medium">{p.price} ₽</span>
                    </div>
                  </div>

                  <form action={addToCart} className="flex items-center gap-2">
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="procurementId" value={procurement.id} />
                    <input type="hidden" name="productId" value={p.id} />
                    <input
                      name="qty"
                      type="number"
                      min="1"
                      defaultValue="1"
                      className="w-20 rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                    <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                      В корзину
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Корзина */}
        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-medium">Корзина</div>

          <div className="mt-3 text-sm text-zinc-600">
            Итого: <span className="font-medium">{cartTotal} ₽</span>
          </div>

          <ul className="mt-3 space-y-2">
            {cartItems.length === 0 ? (
              <li className="text-sm text-zinc-600">Пока пусто. Добавь товары слева.</li>
            ) : (
              cartItems.map((it) => (
                <li key={it.id} className="rounded-xl border bg-zinc-50 p-3">
                  <div className="font-medium">{it.product.name}</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    {it.qty} × {it.price} ₽ = <span className="font-medium">{it.qty * it.price} ₽</span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </main>
  );
}
