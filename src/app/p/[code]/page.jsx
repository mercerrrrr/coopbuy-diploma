import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addToCart, removeFromCart, decreaseQty, clearCart, submitOrder } from "./actions";
import { SubmitOrderForm } from "./ClientForms";
import Link from "next/link";
import QRCode from "qrcode";

export default async function PublicProcurementPage({ params }) {
  const { code } = await params;

  // Determine identity: authenticated user or guest
  const session = await getSession();
  const isResident = session?.role === "RESIDENT";

  const cookieStore = await cookies();
  const guestId = cookieStore.get("cb_guest")?.value ?? null;

  const procurement = await prisma.procurement.findUnique({
    where: { inviteCode: code },
    include: {
      supplier: true,
      pickupPoint: true,
      settlement: { include: { region: true } },
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

  const isOpen = procurement.status === "OPEN";
  const deadlinePassed = new Date() > new Date(procurement.deadlineAt);
  const isLocked = !isOpen || deadlinePassed;

  // Order lookup: by userId if authenticated, else by guestId
  const orderWhere = isResident
    ? { procurementId: procurement.id, userId: String(session.sub) }
    : guestId
      ? { procurementId: procurement.id, guestId }
      : null;

  const [products, order] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: procurement.supplierId, isActive: true },
      orderBy: { name: "asc" },
      include: { category: true, unit: true },
    }),
    orderWhere
      ? prisma.order.findFirst({
          where: orderWhere,
          include: { items: { include: { product: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve(null),
  ]);

  const isSubmitted = order?.status === "SUBMITTED";
  const canEdit = !isLocked && !isSubmitted;

  const cartItems = order?.items ?? [];
  const cartTotal = cartItems.reduce((sum, it) => sum + it.qty * it.price, 0);

  // QR for submitted resident order
  const qrDataUrl =
    isSubmitted && order?.id && isResident
      ? await QRCode.toDataURL(order.id, { margin: 1, width: 200 })
      : null;

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Заголовок */}
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

        {/* Баннер блокировки */}
        {isLocked && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {!isOpen ? "Закупка закрыта." : "Дедлайн истёк."} Приём заявок завершён.
          </div>
        )}

        {/* Окно выдачи */}
        {(procurement.pickupWindowStart || procurement.pickupInstructions) && (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <div className="font-medium">Информация о выдаче</div>
            {procurement.pickupWindowStart && (
              <div className="mt-1">
                Окно выдачи:{" "}
                <span className="font-medium">
                  {new Date(procurement.pickupWindowStart).toLocaleString("ru-RU")}
                  {procurement.pickupWindowEnd &&
                    ` — ${new Date(procurement.pickupWindowEnd).toLocaleString("ru-RU")}`}
                </span>
              </div>
            )}
            {procurement.pickupInstructions && (
              <div className="mt-1">{procurement.pickupInstructions}</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Каталог */}
        <section className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-medium">Каталог</div>
          <ul className="mt-3 space-y-3">
            {products.map((p) => (
              <li key={p.id} className="rounded-xl border bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {p.category.name} • {p.unit.name} • <span className="font-medium">{p.price} ₽</span>
                    </div>
                  </div>

                  {canEdit ? (
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
                  ) : (
                    <span className="text-xs text-zinc-400">
                      {isSubmitted ? "Заявка оформлена" : "Недоступно"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Корзина / Подтверждение */}
        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          {isSubmitted ? (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                Заявка подтверждена
              </div>
              {order.participantName && (
                <p className="mt-2 text-sm text-zinc-600">
                  Участник: <span className="font-medium">{order.participantName}</span>
                  {order.participantPhone && ` • ${order.participantPhone}`}
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {cartItems.map((it) => (
                  <li key={it.id} className="rounded-xl border bg-zinc-50 p-3">
                    <div className="font-medium">{it.product.name}</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {it.qty} × {it.price} ₽ ={" "}
                      <span className="font-medium">{it.qty * it.price} ₽</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Payment summary */}
              {(() => {
                const goodsTotal = order.goodsTotal ?? cartTotal;
                const deliveryShare = order.deliveryShare ?? 0;
                const grandTotal = order.grandTotal ?? goodsTotal;
                const paymentLabel = { UNPAID: "Не оплачено", PAID: "Оплачено", PAY_ON_PICKUP: "При выдаче" }[order.paymentStatus] ?? order.paymentStatus;
                const paymentColor = { UNPAID: "border-red-200 bg-red-50 text-red-800", PAID: "border-emerald-200 bg-emerald-50 text-emerald-800", PAY_ON_PICKUP: "border-sky-200 bg-sky-50 text-sky-800" }[order.paymentStatus] ?? "border-zinc-200 bg-zinc-50 text-zinc-800";
                return (
                  <div className={`mt-3 rounded-xl border px-3 py-2 text-sm space-y-1 ${paymentColor}`}>
                    {deliveryShare > 0 && (
                      <div className="flex justify-between text-xs opacity-80">
                        <span>Товары</span><span>{goodsTotal} ₽</span>
                      </div>
                    )}
                    {deliveryShare > 0 && (
                      <div className="flex justify-between text-xs opacity-80">
                        <span>Доставка</span><span>{deliveryShare} ₽</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span>К оплате</span><span>{grandTotal} ₽</span>
                    </div>
                    <div className="text-xs opacity-80">{paymentLabel}</div>
                  </div>
                );
              })()}

              {/* QR + receipt (for RESIDENT) */}
              {qrDataUrl && (
                <div className="mt-4 border-t pt-4 text-center">
                  <div className="text-xs text-zinc-500 mb-2">QR-код для получения заказа</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR" width={160} height={160} className="mx-auto" />
                  <div className="mt-3">
                    <Link
                      href={`/my/orders/${order.id}`}
                      className="block w-full rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
                    >
                      Детали и QR
                    </Link>
                    <Link
                      href={`/my/orders/${order.id}/receipt.pdf`}
                      className="mt-2 block w-full rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
                    >
                      Скачать квитанцию PDF
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-medium">Корзина</div>
              <div className="mt-2 text-sm text-zinc-600">
                Итого: <span className="font-medium">{cartTotal} ₽</span>
              </div>

              <ul className="mt-3 space-y-2">
                {cartItems.length === 0 ? (
                  <li className="text-sm text-zinc-500">Пока пусто. Добавь товары слева.</li>
                ) : (
                  cartItems.map((it) => (
                    <li key={it.id} className="rounded-xl border bg-zinc-50 p-3">
                      <div className="font-medium">{it.product.name}</div>
                      <div className="mt-1 text-sm text-zinc-600">
                        {it.qty} × {it.price} ₽ ={" "}
                        <span className="font-medium">{it.qty * it.price} ₽</span>
                      </div>

                      {canEdit && (
                        <div className="mt-2 flex gap-2">
                          <form action={decreaseQty}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="code" value={code} />
                            <button className="rounded-lg border px-2 py-1 text-xs hover:bg-zinc-100">
                              −1
                            </button>
                          </form>
                          <form action={removeFromCart}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="code" value={code} />
                            <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                              Удалить
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>

              {canEdit && cartItems.length > 0 && (
                <>
                  <form action={clearCart} className="mt-3">
                    <input type="hidden" name="procurementId" value={procurement.id} />
                    <input type="hidden" name="code" value={code} />
                    <button className="text-xs text-zinc-500 underline hover:text-zinc-800">
                      Очистить корзину
                    </button>
                  </form>

                  {/* Submit: only RESIDENT can submit */}
                  {!session ? (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-sm text-zinc-600 mb-2">
                        Для оформления заявки необходимо войти.
                      </p>
                      <Link
                        href={`/auth/login?next=/p/${code}`}
                        className="block w-full rounded-xl bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
                      >
                        Войти, чтобы оформить
                      </Link>
                      <Link
                        href={`/auth/register?next=/p/${code}`}
                        className="mt-2 block w-full rounded-xl border border-zinc-200 px-4 py-2 text-center text-sm text-zinc-600 hover:bg-zinc-50"
                      >
                        Зарегистрироваться
                      </Link>
                    </div>
                  ) : !isResident ? (
                    <div className="mt-4 border-t pt-4 text-sm text-zinc-500">
                      Только участники (RESIDENT) могут оформлять заявки.
                    </div>
                  ) : (
                    <SubmitOrderForm
                      action={submitOrder}
                      procurementId={procurement.id}
                      code={code}
                    />
                  )}
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
