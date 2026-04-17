import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import {
  checkinOrder,
  createPickupSession,
  closePickupSession,
} from "@/app/admin/procurements/[id]/actions";
import {
  CreatePickupSessionForm,
  CheckinOrderForm,
  ManualCheckinForm,
  ClosePickupSessionForm,
} from "@/app/admin/procurements/[id]/PickupForms";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAYMENT_LABELS, PAYMENT_VARIANTS } from "@/lib/constants";
import { getOrderTotals } from "@/lib/orders";

export default async function OperatorCheckinPage() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    redirect("/auth/login");
  }

  await autoCloseExpiredProcurements(prisma);

  // Operator sees only their pickup point; admin sees all
  const pickupPointFilter =
    session.role === "OPERATOR" && session.pickupPointId
      ? { pickupPointId: session.pickupPointId }
      : {};

  const procurements = await prisma.procurement.findMany({
    where: {
      status: { in: ["OPEN", "CLOSED"] },
      ...pickupPointFilter,
    },
    include: {
      supplier: true,
      pickupPoint: true,
      pickupSession: { include: { checkins: true } },
      orders: {
        where: { status: "SUBMITTED" },
        include: {
          items: { include: { product: { include: { unit: true } } } },
          checkin: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      _count: { select: { orders: { where: { status: "SUBMITTED" } } } },
    },
    orderBy: { deadlineAt: "desc" },
  });

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Пункт выдачи"
        title="Выдача заказов"
        description="Сканируйте QR-код или введите 6-значный код получения для выдачи заказа"
      />

      {procurements.length === 0 ? (
        <EmptyState
          title="Нет закупок"
          description="Закупки для вашего пункта выдачи ещё не созданы"
        />
      ) : (
        procurements.map((procurement) => {
          const pickupSession = procurement.pickupSession;
          const submittedOrders = procurement.orders;
          const checkinCount = pickupSession?.checkins.length ?? 0;
          const sessionClosed = pickupSession?.status === "CLOSED";

          return (
            <Card key={procurement.id}>
              <CardHeader>
                <div>
                  <CardTitle>{procurement.title}</CardTitle>
                  <p className="mt-0.5 text-xs text-[color:var(--cb-text-faint)]">
                    {procurement.supplier.name} · {procurement.pickupPoint.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={procurement.status === "OPEN" ? "success" : "neutral"}>
                    {procurement.status === "OPEN" ? "Открыта" : "Закрыта"}
                  </Badge>
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
                      <span className="text-xs text-[color:var(--cb-text-soft)]">
                        Выдано: {checkinCount} / {submittedOrders.length}
                      </span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                {/* No session yet */}
                {!pickupSession && (
                  submittedOrders.length === 0 ? (
                    <EmptyState
                      title="Нет подтверждённых заявок"
                      description="Сессию выдачи можно создать после появления заявок"
                    />
                  ) : (
                    <CreatePickupSessionForm
                      action={createPickupSession}
                      procurementId={procurement.id}
                      pickupWindowStart={procurement.pickupWindowStart}
                      pickupWindowEnd={procurement.pickupWindowEnd}
                    />
                  )
                )}

                {/* Active session */}
                {pickupSession && (
                  <>
                    {!sessionClosed && (
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <ManualCheckinForm
                          action={checkinOrder}
                          procurementId={procurement.id}
                          sessionId={pickupSession.id}
                        />
                        <ClosePickupSessionForm
                          action={closePickupSession}
                          procurementId={procurement.id}
                          sessionId={pickupSession.id}
                        />
                      </div>
                    )}

                    {/* Orders list */}
                    <div className="space-y-2">
                      {submittedOrders.length === 0 ? (
                        <EmptyState title="Нет заявок к выдаче" />
                      ) : (
                        submittedOrders.map((order) => {
                          const { grandTotal } = getOrderTotals(order);
                          const isCheckedIn = Boolean(order.checkin);
                          const isUnpaid = order.paymentStatus === "UNPAID";

                          return (
                            <div
                              key={order.id}
                              className={[
                                "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors",
                                isCheckedIn
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-[color:var(--cb-bg-soft)] border-[color:var(--cb-line)] hover:bg-[color:var(--cb-bg)]",
                              ].join(" ")}
                            >
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link
                                    href={`/admin/checkin/${order.id}`}
                                    className="font-medium text-[color:var(--cb-text)] hover:text-[color:var(--cb-accent)] transition-colors"
                                  >
                                    {order.participantName ?? "—"}
                                  </Link>
                                  {order.participantPhone && (
                                    <span className="text-[color:var(--cb-text-faint)] text-xs">
                                      {order.participantPhone}
                                    </span>
                                  )}
                                  <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? "neutral"}>
                                    {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                                  </Badge>
                                </div>
                                {order.pickupCode && (
                                  <div className="mt-0.5 text-xs font-mono text-[color:var(--cb-text-faint)]">
                                    Код: {order.pickupCode}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-[color:var(--cb-text)]">
                                  {grandTotal.toLocaleString("ru-RU")} ₽
                                </span>
                                {isCheckedIn ? (
                                  <Badge variant="success">Выдано</Badge>
                                ) : !sessionClosed ? (
                                  <CheckinOrderForm
                                    action={checkinOrder}
                                    procurementId={procurement.id}
                                    sessionId={pickupSession.id}
                                    orderId={order.id}
                                    participantName={order.participantName}
                                  />
                                ) : (
                                  <span className="text-xs text-[color:var(--cb-text-faint)]">Не выдано</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          );
        })
      )}
    </main>
  );
}
