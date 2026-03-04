import Link from "next/link";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/baseUrl";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import {
  createReceivingReport,
  updateReceivingLine,
  finalizeReceivingReport,
  createPickupSession,
  checkinOrder,
  closePickupSession,
  updateDeliverySettings,
  recalcShares,
  updatePaymentStatus,
} from "./actions";
import { ConfirmForm, ReceivingLineRow } from "./ReceivingForms";
import {
  CreatePickupSessionForm,
  CheckinOrderForm,
  ManualCheckinForm,
  ClosePickupSessionForm,
} from "./PickupForms";
import { DeliverySettingsForm } from "./DeliveryPaymentForms";
import { OrdersSearchTable } from "./OrdersSearchTable";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineMessage } from "@/components/ui/InlineMessage";
import {
  ChevronRight,
  Package,
  Truck,
  Users,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  BarChart2,
  History,
  HandCoins,
} from "lucide-react";

const PAYMENT_LABELS = {
  UNPAID: "Не оплачено",
  PAID: "Оплачено",
  PAY_ON_PICKUP: "При выдаче",
};

const PAYMENT_VARIANTS = {
  UNPAID: "danger",
  PAID: "success",
  PAY_ON_PICKUP: "info",
};

// Note: PAYMENT_LABELS/VARIANTS also duplicated in OrdersSearchTable for the search filter

export default async function ProcurementDetailPage({ params }) {
  const { id } = await params;
  const baseUrl = await getBaseUrl();

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    include: {
      supplier: true,
      settlement: { include: { region: true } },
      pickupPoint: true,
    },
  });

  if (!procurement) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">Закупка не найдена.</p>
        </div>
      </main>
    );
  }

  const ORDERS_CAP = 300;

  const [submittedOrders, totalOrdersCount, receivingReport, pickupSession, auditLogs] =
    await Promise.all([
      prisma.order.findMany({
        where: { procurementId: id, status: "SUBMITTED" },
        include: {
          items: { include: { product: { include: { category: true, unit: true } } } },
          checkin: true,
        },
        orderBy: { updatedAt: "desc" },
        take: ORDERS_CAP,
      }),
      prisma.order.count({ where: { procurementId: id, status: "SUBMITTED" } }),
      prisma.receivingReport.findUnique({
        where: { procurementId: id },
        include: {
          lines: {
            include: { product: { select: { name: true, unit: { select: { name: true } } } } },
            orderBy: { product: { name: "asc" } },
          },
        },
      }),
      prisma.pickupSession.findUnique({
        where: { procurementId: id },
        include: { checkins: true },
      }),
      prisma.auditLog.findMany({
        where: { entityId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

  // Агрегация по продукту
  const aggMap = new Map();
  for (const order of submittedOrders) {
    for (const item of order.items) {
      const p = item.product;
      if (!aggMap.has(p.id)) {
        aggMap.set(p.id, {
          name: p.name,
          category: p.category.name,
          unit: p.unit.name,
          totalQty: 0,
          totalSum: 0,
        });
      }
      const agg = aggMap.get(p.id);
      agg.totalQty += item.qty;
      agg.totalSum += item.qty * item.price;
    }
  }
  const aggRows = Array.from(aggMap.values()).sort((a, b) => b.totalSum - a.totalSum);

  const submittedTotal = submittedOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.qty * i.price, 0),
    0
  );
  const progress =
    procurement.minTotalSum > 0
      ? Math.min(100, Math.round((submittedTotal / procurement.minTotalSum) * 100))
      : null;

  const isFinal = receivingReport?.status === "FINAL";
  const discrepancyCount =
    receivingReport?.lines.filter((l) => l.receivedQty !== l.expectedQty).length ?? 0;

  const checkinCount = pickupSession?.checkins.length ?? 0;
  const sessionClosed = pickupSession?.status === "CLOSED";

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-5">
      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2">
          <Link href="/admin/procurements" className="hover:text-zinc-700 transition-colors">
            Закупки
          </Link>
          <ChevronRight size={12} />
          <span className="text-zinc-600 font-medium">{procurement.title}</span>
        </nav>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-zinc-900">{procurement.title}</h1>
          <Link
            href={`/admin/procurements/${id}/report`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 shadow-sm transition-colors"
          >
            <BarChart2 size={13} />
            Отчёт
          </Link>
        </div>
      </div>

      {/* Warning: orders cap reached */}
      {totalOrdersCount > ORDERS_CAP && (
        <InlineMessage variant="warning">
          Показаны первые {ORDERS_CAP} заявок из {totalOrdersCount}. Для полного списка
          используйте экспорт{" "}
          <a
            href={`/admin/procurements/${id}/export.xlsx`}
            className="underline font-medium"
          >
            XLSX
          </a>
          .
        </InlineMessage>
      )}

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Информация о закупке</CardTitle>
          <Badge variant="neutral">{procurement.status}</Badge>
        </CardHeader>
        <CardBody className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <div className="text-xs text-zinc-400 mb-0.5">Поставщик</div>
            <div className="font-medium text-zinc-900">{procurement.supplier.name}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-0.5">Населённый пункт</div>
            <div className="font-medium text-zinc-900">
              {procurement.settlement.region.name} · {procurement.settlement.name}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-0.5">Пункт выдачи</div>
            <div className="font-medium text-zinc-900">
              {procurement.pickupPoint.name}
              {procurement.pickupPoint.address && (
                <span className="text-zinc-500 font-normal">
                  {" "}— {procurement.pickupPoint.address}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-0.5">Дедлайн</div>
            <div className="font-medium text-zinc-900">
              {new Date(procurement.deadlineAt).toLocaleString("ru-RU")}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-0.5">Мин. сбор</div>
            <div className="font-medium text-zinc-900">
              {procurement.minTotalSum.toLocaleString("ru-RU")} ₽
            </div>
          </div>
          {procurement.pickupWindowStart && (
            <div>
              <div className="text-xs text-zinc-400 mb-0.5">Окно выдачи</div>
              <div className="font-medium text-zinc-900">
                {new Date(procurement.pickupWindowStart).toLocaleString("ru-RU")}
                {procurement.pickupWindowEnd &&
                  ` — ${new Date(procurement.pickupWindowEnd).toLocaleString("ru-RU")}`}
              </div>
            </div>
          )}
          {procurement.pickupInstructions && (
            <div className="sm:col-span-2">
              <div className="text-xs text-zinc-400 mb-0.5">Инструкции</div>
              <div className="font-medium text-zinc-900">{procurement.pickupInstructions}</div>
            </div>
          )}
          <div className="sm:col-span-2">
            <div className="text-xs text-zinc-400 mb-0.5">Invite-ссылка</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <code className="text-xs bg-zinc-100 rounded px-2 py-0.5 text-zinc-700 font-mono break-all">
                {baseUrl}/p/{procurement.inviteCode}
              </code>
              <CopyLinkButton textToCopy={`${baseUrl}/p/${procurement.inviteCode}`} label="Скопировать" />
              <Link
                href={`/p/${procurement.inviteCode}`}
                className="text-xs text-indigo-600 hover:text-indigo-700 underline"
              >
                Открыть →
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Прогресс сбора</CardTitle>
          <span className="text-sm">
            <span className="font-bold text-zinc-900">
              {submittedTotal.toLocaleString("ru-RU")} ₽
            </span>
            {procurement.minTotalSum > 0 && (
              <span className="text-zinc-400 text-xs ml-1">
                / {procurement.minTotalSum.toLocaleString("ru-RU")} ₽
              </span>
            )}
            {progress !== null && (
              <span className="ml-2 font-semibold text-indigo-600">{progress}%</span>
            )}
          </span>
        </CardHeader>
        <CardBody>
          {progress !== null && (
            <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-2 rounded-full bg-indigo-500 animate-progress"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            Подтверждённых заявок:{" "}
            <span className="font-medium text-zinc-600">{submittedOrders.length}</span>
          </p>
        </CardBody>
      </Card>

      {/* Delivery & Payment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HandCoins size={16} className="text-zinc-400" />
            <CardTitle>Доставка и оплата</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/procurements/${id}/payments.xlsx`}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet size={12} />
              Payments XLSX
            </Link>
            <form action={recalcShares}>
              <input type="hidden" name="procurementId" value={id} />
              <button className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
                Пересчитать доли
              </button>
            </form>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="text-xs text-zinc-500">
            Доставка:{" "}
            <span className="font-semibold text-zinc-700">
              {procurement.deliveryFee.toLocaleString("ru-RU")} ₽
            </span>
            <span className="ml-2 text-zinc-400">
              {procurement.deliverySplitMode === "PROPORTIONAL_SUM" && "· Пропорционально сумме"}
              {procurement.deliverySplitMode === "EQUAL" && "· Поровну"}
              {procurement.deliverySplitMode === "PER_ITEM" && "· По кол-ву товаров"}
            </span>
          </div>

          <DeliverySettingsForm
            action={updateDeliverySettings}
            procurementId={id}
            deliveryFee={procurement.deliveryFee}
            deliverySplitMode={procurement.deliverySplitMode}
          />

          {submittedOrders.length === 0 ? (
            <EmptyState title="Нет подтверждённых заявок" />
          ) : (
            <OrdersSearchTable
              orders={submittedOrders}
              procurementId={id}
              updatePaymentStatus={updatePaymentStatus}
            />
          )}
        </CardBody>
      </Card>

      {/* Aggregate supplier order */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package size={16} className="text-zinc-400" />
            <CardTitle>Агрегированный заказ поставщику</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/procurements/${id}/export.csv`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              CSV
            </Link>
            <Link
              href={`/admin/procurements/${id}/export.pdf`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <FileText size={12} />
              PDF
            </Link>
            <Link
              href={`/admin/procurements/${id}/export.xlsx`}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet size={12} />
              XLSX
            </Link>
          </div>
        </CardHeader>
        <CardBody>
          {aggRows.length === 0 ? (
            <EmptyState
              title="Нет подтверждённых заявок"
              description="Агрегированный список появится после первой подтверждённой заявки"
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                    <th className="px-3 py-2.5 font-medium">Наименование</th>
                    <th className="px-3 py-2.5 font-medium">Категория</th>
                    <th className="px-3 py-2.5 font-medium">Ед.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Кол-во</th>
                    <th className="px-3 py-2.5 font-medium text-right">Сумма, ₽</th>
                  </tr>
                </thead>
                <tbody>
                  {aggRows.map((row, idx) => (
                    <tr
                      key={row.name}
                      className={[
                        "border-b last:border-0 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40",
                        "hover:bg-indigo-50/20",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2.5 font-medium text-zinc-900">{row.name}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{row.category}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{row.unit}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-700">{row.totalQty}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-zinc-900">
                        {row.totalSum.toLocaleString("ru-RU")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50">
                    <td
                      colSpan={4}
                      className="px-3 py-2.5 text-right text-xs text-zinc-500 font-medium"
                    >
                      Итого:
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-zinc-900">
                      {submittedTotal.toLocaleString("ru-RU")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pickup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Truck size={16} className="text-zinc-400" />
            <CardTitle>Выдача</CardTitle>
            {pickupSession && (
              <>
                <Badge
                  variant={
                    pickupSession.status === "ACTIVE"
                      ? "success"
                      : pickupSession.status === "CLOSED"
                      ? "neutral"
                      : "warning"
                  }
                >
                  {pickupSession.status === "PLANNED"
                    ? "Запланирована"
                    : pickupSession.status === "ACTIVE"
                    ? "Активна"
                    : "Завершена"}
                </Badge>
                <span className="text-xs text-zinc-400">
                  Выдано: {checkinCount} / {submittedOrders.length}
                </span>
              </>
            )}
          </div>
          {pickupSession && !sessionClosed && (
            <ClosePickupSessionForm
              action={closePickupSession}
              procurementId={id}
              sessionId={pickupSession.id}
            />
          )}
        </CardHeader>
        <CardBody>
          {!pickupSession ? (
            submittedOrders.length === 0 ? (
              <EmptyState
                title="Нет подтверждённых заявок"
                description="Сессию выдачи можно создать после появления SUBMITTED заявок"
              />
            ) : (
              <CreatePickupSessionForm
                action={createPickupSession}
                procurementId={id}
                pickupWindowStart={procurement.pickupWindowStart}
                pickupWindowEnd={procurement.pickupWindowEnd}
              />
            )
          ) : (
            <div className="space-y-4">
              {!sessionClosed && (
                <ManualCheckinForm
                  action={checkinOrder}
                  procurementId={id}
                  sessionId={pickupSession.id}
                />
              )}
              <div className="space-y-2">
                {submittedOrders.map((order) => {
                  const orderTotal =
                    order.grandTotal ??
                    order.items.reduce((s, i) => s + i.qty * i.price, 0);
                  const isCheckedIn = Boolean(order.checkin);
                  const isUnpaid = order.paymentStatus === "UNPAID";
                  return (
                    <div
                      key={order.id}
                      className={[
                        "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors",
                        isCheckedIn
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-zinc-50/50 border-zinc-200 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-900">
                            {order.participantName ?? "—"}
                          </span>
                          {order.participantPhone && (
                            <span className="text-zinc-400 text-xs">
                              {order.participantPhone}
                            </span>
                          )}
                          {isUnpaid && !isCheckedIn && (
                            <Badge variant="danger">Не оплачено</Badge>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">{order.id}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-zinc-700">
                          {orderTotal.toLocaleString("ru-RU")} ₽
                        </span>
                        {isCheckedIn ? (
                          <Badge variant="success">Выдано</Badge>
                        ) : !sessionClosed ? (
                          <CheckinOrderForm
                            action={checkinOrder}
                            procurementId={id}
                            sessionId={pickupSession.id}
                            orderId={order.id}
                            participantName={order.participantName}
                          />
                        ) : (
                          <span className="text-xs text-zinc-400">Не выдано</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Receiving report */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardList size={16} className="text-zinc-400" />
            <CardTitle>Приёмка поставки</CardTitle>
            {receivingReport && (
              <>
                <Badge variant={isFinal ? "success" : "warning"}>
                  {isFinal ? "Финализирован" : "Черновик"}
                </Badge>
                {discrepancyCount > 0 && (
                  <Badge variant="danger">Расхождений: {discrepancyCount}</Badge>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {receivingReport && (
              <Link
                href={`/admin/procurements/${id}/receiving.csv`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Акт CSV
              </Link>
            )}
            {receivingReport && (
              <Link
                href={`/admin/procurements/${id}/receiving.xlsx`}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet size={12} />
                Акт XLSX
              </Link>
            )}
            {receivingReport && !isFinal && (
              <ConfirmForm
                action={finalizeReceivingReport}
                hiddenFields={{ reportId: receivingReport.id, procurementId: id }}
                label="Финализировать"
                confirmText="Финализировать акт? Редактирование строк будет заблокировано."
                buttonClass="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
              />
            )}
          </div>
        </CardHeader>
        <CardBody>
          {!receivingReport ? (
            submittedOrders.length === 0 ? (
              <EmptyState
                title="Нет подтверждённых заявок"
                description="Акт приёмки можно создать после появления SUBMITTED заявок"
              />
            ) : (
              <form action={createReceivingReport}>
                <input type="hidden" name="procurementId" value={id} />
                <input type="hidden" name="id" value={id} />
                <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
                  Создать акт приёмки
                </button>
              </form>
            )
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                    <th className="px-3 py-2.5 font-medium">Товар</th>
                    <th className="px-3 py-2.5 font-medium">Ед.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Ожидалось</th>
                    <th className="px-3 py-2.5 font-medium text-right">Получено</th>
                    <th className="px-3 py-2.5 font-medium text-right">Δ</th>
                    <th className="px-3 py-2.5 font-medium">Комментарий</th>
                    {!isFinal && <th className="px-3 py-2.5 font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {receivingReport.lines.map((line) => (
                    <ReceivingLineRow
                      key={line.id}
                      line={line}
                      procurementId={id}
                      updateAction={updateReceivingLine}
                      isFinal={isFinal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Orders detail list */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-zinc-400" />
            <CardTitle>Заявки участников</CardTitle>
            <span className="text-xs text-zinc-400">({submittedOrders.length})</span>
          </div>
        </CardHeader>
        <CardBody>
          {submittedOrders.length === 0 ? (
            <EmptyState
              title="Нет подтверждённых заявок"
              description="Заявки появятся когда участники оформят и подтвердят заказы"
            />
          ) : (
            <div className="space-y-2">
              {submittedOrders.map((order) => {
                const orderTotal =
                  order.grandTotal ??
                  order.items.reduce((s, i) => s + i.qty * i.price, 0);
                return (
                  <details
                    key={order.id}
                    className="rounded-xl border border-zinc-200 overflow-hidden"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-900">
                            {order.participantName ?? "—"}
                          </span>
                          {order.participantPhone && (
                            <span className="text-zinc-400 text-xs">{order.participantPhone}</span>
                          )}
                          {order.checkin && <Badge variant="success">Выдано</Badge>}
                          <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                            {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span>{new Date(order.updatedAt).toLocaleString("ru-RU")}</span>
                          <span className="font-bold text-zinc-700">
                            {orderTotal.toLocaleString("ru-RU")} ₽
                          </span>
                        </div>
                      </div>
                    </summary>
                    <div className="px-4 pb-4 pt-3 border-t border-zinc-100 bg-white">
                      <ul className="space-y-1.5">
                        {order.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between text-sm text-zinc-600"
                          >
                            <span>{item.product.name}</span>
                            <span className="text-zinc-500">
                              {item.qty} × {item.price} ₽ ={" "}
                              <span className="font-medium text-zinc-800">
                                {(item.qty * item.price).toLocaleString("ru-RU")} ₽
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {(order.deliveryShare ?? 0) > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-100 text-xs text-zinc-500 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Товары</span>
                            <span>{order.goodsTotal?.toLocaleString("ru-RU")} ₽</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Доставка</span>
                            <span>{order.deliveryShare?.toLocaleString("ru-RU")} ₽</span>
                          </div>
                          <div className="flex justify-between font-semibold text-zinc-700">
                            <span>Итого</span>
                            <span>{order.grandTotal?.toLocaleString("ru-RU")} ₽</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History size={16} className="text-zinc-400" />
            <CardTitle>Журнал действий</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Нет записей.</p>
          ) : (
            <ul className="space-y-0.5">
              {auditLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap gap-2 text-xs py-2 border-b border-zinc-100 last:border-0"
                >
                  <span className="text-zinc-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString("ru-RU")}
                  </span>
                  <span
                    className={
                      log.actorType === "ADMIN"
                        ? "font-medium text-zinc-700"
                        : "text-zinc-500"
                    }
                  >
                    [{log.actorType}] {log.actorLabel}
                  </span>
                  <code className="text-indigo-600 font-mono">{log.action}</code>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
