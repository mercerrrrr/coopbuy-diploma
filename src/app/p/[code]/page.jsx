import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addToCart, removeFromCart, decreaseQty, clearCart, submitOrder } from "./actions";
import { SubmitOrderForm } from "./ClientForms";
import {
  canResidentParticipateInProcurement,
  getResidentProcurementAccess,
} from "@/lib/guards";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { getProcurementState } from "@/lib/procurements/state";
import { PAYMENT_LABELS } from "@/lib/constants";
import { getItemsGoodsTotal, getOrderTotals } from "@/lib/orders";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PublicProcurementPage({ params, searchParams }) {
  const { code } = await params;
  const { flash, flashType } = await searchParams;

  await autoCloseExpiredProcurements(prisma);

  const session = await getSession();
  const isResident = session?.role === "RESIDENT";

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
      <main className="cb-shell py-4">
        <div className="cb-panel-strong rounded-[1.25rem] p-5">
          <h1 className="text-xl font-semibold text-[color:var(--cb-text)]">Закупка не найдена</h1>
          <p className="mt-1.5 text-sm text-[color:var(--cb-text-soft)]">
            Проверьте ссылку или запросите новую у организатора.
          </p>
        </div>
      </main>
    );
  }

  const [products, submittedStats] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: procurement.supplierId, isActive: true },
      orderBy: { name: "asc" },
      include: { category: true, unit: true },
    }),
    prisma.order.aggregate({
      where: { procurementId: procurement.id, status: "SUBMITTED" },
      _sum: { goodsTotal: true },
    }),
  ]);

  const submittedTotal = submittedStats._sum.goodsTotal ?? 0;
  const procurementState = getProcurementState(procurement, submittedTotal);
  const access = getResidentProcurementAccess({ session, procurement, procurementState });
  const sameSettlementResident =
    isResident &&
    session?.settlementId &&
    String(session.settlementId) === String(procurement.settlementId);

  const order = sameSettlementResident
    ? await prisma.order.findFirst({
        where: { procurementId: procurement.id, userId: String(session.sub) },
        include: { items: { include: { product: true } } },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  const isSubmitted = order?.status === "SUBMITTED";
  const canParticipate = canResidentParticipateInProcurement(access);
  const canEdit = canParticipate && !isSubmitted;

  const cartItems = order?.items ?? [];
  const cartTotal = getItemsGoodsTotal(cartItems);

  const qrDataUrl =
    isSubmitted && order?.id && isResident
      ? await QRCode.toDataURL(order.id, { margin: 1, width: 200 })
      : null;

  const bannerConfig = {
    login_required: {
      type: "info",
      title: "Нужен вход в систему",
    },
    wrong_role: {
      type: "warning",
      title: "Недоступно для вашей роли",
    },
    wrong_settlement: {
      type: "error",
      title: "Доступ ограничен по населённому пункту",
    },
    deadline_closed: {
      type: "warning",
      title: "Приём заявок завершён",
    },
    minimum_not_reached: {
      type: "error",
      title: "Минимальная сумма не достигнута",
    },
  }[access.status];

  return (
    <main className="cb-shell space-y-4 py-4">
      <PageHeader
        eyebrow="Закупка"
        title={procurement.title}
        description={`Поставщик: ${procurement.supplier.name}. Населённый пункт: ${procurement.settlement.name}. Пункт выдачи: ${procurement.pickupPoint.name}.${procurement.settlement.region.name ? ` Регион: ${procurement.settlement.region.name}.` : ""}`}
        meta={
          <div className="rounded-[0.9rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-left md:text-right">
            <div className="text-xs text-[color:var(--cb-text-soft)]">Приём заявок до</div>
            <div className="mt-1 text-base font-semibold text-[color:var(--cb-text)]">
              {new Date(procurement.deadlineAt).toLocaleString("ru-RU")}
            </div>
            <div className="mt-1 text-xs text-[color:var(--cb-text-soft)]">
              Минимальная сумма: {procurement.minTotalSum.toLocaleString("ru-RU")} ₽
            </div>
          </div>
        }
      />

      {bannerConfig && (
          <InlineMessage type={bannerConfig.type} className="mt-3">
            <div className="font-medium">{bannerConfig.title}</div>
            <div className="mt-1">{access.message}</div>
            {access.status === "wrong_settlement" && (
              <div className="mt-1 text-xs opacity-80">
                Закупка относится к населённому пункту {procurement.settlement.name}
                {procurement.settlement.region.name ? ` (${procurement.settlement.region.name})` : ""}.
              </div>
            )}
            {access.status === "login_required" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/auth/login?next=/p/${code}`}
                  className="inline-flex min-h-9 items-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
                >
                  Войти
                </Link>
                <Link
                  href={`/auth/register?next=/p/${code}`}
                  className="inline-flex min-h-9 items-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                >
                  Зарегистрироваться
                </Link>
              </div>
            )}
            {access.status === "minimum_not_reached" && (
              <div className="mt-1 text-xs opacity-80">
                Собрано {submittedTotal.toLocaleString("ru-RU")} ₽ из требуемых {procurement.minTotalSum.toLocaleString("ru-RU")} ₽.
              </div>
            )}
          </InlineMessage>
        )}

      {(procurement.pickupWindowStart || procurement.pickupInstructions) && (
        <InlineMessage type="info">
          {procurement.pickupWindowStart && (
            <div>
              Выдача:{" "}
              <span className="font-medium">
                {new Date(procurement.pickupWindowStart).toLocaleString("ru-RU")}
                {procurement.pickupWindowEnd &&
                  ` — ${new Date(procurement.pickupWindowEnd).toLocaleString("ru-RU")}`}
              </span>
            </div>
          )}
          {procurement.pickupInstructions && <div className="mt-1">{procurement.pickupInstructions}</div>}
        </InlineMessage>
      )}

      {flash && (
        <InlineMessage type={flashType === "success" ? "success" : "error"}>
            {flash}
        </InlineMessage>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <section className="cb-panel-strong rounded-[1rem] p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--cb-line)] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[color:var(--cb-text)]">Каталог товаров</h2>
              <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                Позиции поставщика, доступные в этой закупке.
              </div>
            </div>
            <div className="rounded-md border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-2.5 py-1 text-xs text-[color:var(--cb-text-soft)]">
              {products.length} позиций
            </div>
          </div>

          {!canParticipate && (
            <p className="mt-3 text-sm text-[color:var(--cb-text-soft)]">
              Каталог доступен для просмотра. Добавление товаров откроется после входа под аккаунтом жителя нужного населённого пункта.
            </p>
          )}

          <ul className="mt-4 divide-y divide-[color:var(--cb-line)] rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]">
            {products.map((p) => (
              <li key={p.id} className="px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[color:var(--cb-text)]">{p.name}</div>
                    <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                      {p.category.name} · {p.unit.name} · <span className="font-medium text-[color:var(--cb-text)]">{p.price} ₽</span>
                    </div>
                  </div>

                  {canEdit ? (
                    <form action={addToCart} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="code" value={code} />
                      <input type="hidden" name="procurementId" value={procurement.id} />
                      <input type="hidden" name="productId" value={p.id} />
                      <input
                        name="qty"
                        type="number"
                        min="1"
                        defaultValue="1"
                        className="h-9 w-20 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-2.5 py-2 text-sm"
                      />
                      <button className="inline-flex min-h-9 items-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]">
                        В корзину
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-[color:var(--cb-text-faint)]">
                      {isSubmitted ? "Заявка оформлена" : "Только просмотр"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="cb-panel-strong rounded-[1rem] p-4 md:p-5 xl:sticky xl:top-20 xl:self-start">
          {isSubmitted ? (
            <>
              <InlineMessage type="success">
                Заявка подтверждена
              </InlineMessage>
              {order.participantName && (
                <p className="mt-3 text-sm text-[color:var(--cb-text-soft)]">
                  Участник: <span className="font-medium text-[color:var(--cb-text)]">{order.participantName}</span>
                  {order.participantPhone && ` · ${order.participantPhone}`}
                </p>
              )}

              <ul className="mt-3 divide-y divide-[color:var(--cb-line)] rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]">
                {cartItems.map((it) => (
                  <li key={it.id} className="px-3.5 py-2.5 text-sm">
                    <div className="font-medium text-[color:var(--cb-text)]">{it.product.name}</div>
                    <div className="mt-1 text-[color:var(--cb-text-soft)]">
                      {it.qty} × {it.price} ₽ = <span className="font-medium text-[color:var(--cb-text)]">{it.qty * it.price} ₽</span>
                    </div>
                  </li>
                ))}
              </ul>

              {(() => {
                const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
                const paymentLabel = PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus;
                const paymentColor =
                  {
                    UNPAID: "border-red-200 bg-red-50 text-red-800",
                    PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
                    PAY_ON_PICKUP: "border-sky-200 bg-sky-50 text-sky-800",
                  }[order.paymentStatus] ?? "border-zinc-200 bg-zinc-50 text-zinc-800";

                return (
                  <div className={`mt-3 space-y-1.5 rounded-[0.8rem] border px-3.5 py-2.5 text-sm ${paymentColor}`}>
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

              {qrDataUrl && (
                <div className="mt-4 border-t border-[color:var(--cb-line)] pt-4 text-center">
                  <div className="mb-2 text-xs text-[color:var(--cb-text-faint)]">QR-код для получения заказа</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR-код заявки"
                    width={180}
                    height={180}
                    className="mx-auto rounded-xl border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] p-2"
                  />
                  <div className="mt-3 grid gap-2">
                    <Link
                      href={`/my/orders/${order.id}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                    >
                      Открыть страницу заказа
                    </Link>
                    <Link
                      href={`/my/orders/${order.id}/receipt.pdf`}
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                    >
                      PDF-квитанция
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-base font-semibold text-[color:var(--cb-text)]">Текущий заказ</div>
              <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                Итого: <span className="font-medium text-[color:var(--cb-text)]">{cartTotal} ₽</span>
              </div>

              <ul className="mt-3 divide-y divide-[color:var(--cb-line)] rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]">
                {cartItems.length === 0 ? (
                  <li className="px-3.5 py-3 text-sm text-[color:var(--cb-text-soft)]">
                    {canParticipate ? "Корзина пуста. Добавьте товары из каталога." : "Корзина недоступна в текущем режиме доступа."}
                  </li>
                ) : (
                  cartItems.map((it) => (
                    <li key={it.id} className="px-3.5 py-3 text-sm">
                      <div className="font-medium text-[color:var(--cb-text)]">{it.product.name}</div>
                      <div className="mt-1 text-[color:var(--cb-text-soft)]">
                        {it.qty} × {it.price} ₽ = <span className="font-medium text-[color:var(--cb-text)]">{it.qty * it.price} ₽</span>
                      </div>

                      {canEdit && (
                        <div className="mt-2 flex gap-2">
                          <form action={decreaseQty}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="code" value={code} />
                            <button className="inline-flex min-h-8 items-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-2.5 py-1.5 text-xs text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]">
                              −1
                            </button>
                          </form>
                          <form action={removeFromCart}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="code" value={code} />
                            <button className="inline-flex min-h-8 items-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50">
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
                    <button className="text-xs text-[color:var(--cb-text-soft)] hover:text-[color:var(--cb-text)]">
                      Очистить корзину
                    </button>
                  </form>

                  <SubmitOrderForm action={submitOrder} procurementId={procurement.id} code={code} />
                </>
              )}

              {!canParticipate && access.status === "login_required" && (
                <div className="mt-4 border-t border-[color:var(--cb-line)] pt-4">
                  <div className="grid gap-2">
                    <Link
                      href={`/auth/login?next=/p/${code}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
                    >
                      Войти по email и паролю
                    </Link>
                    <Link
                      href={`/auth/register?next=/p/${code}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
                    >
                      Зарегистрироваться
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
