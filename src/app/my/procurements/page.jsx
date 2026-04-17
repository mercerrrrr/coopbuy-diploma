import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function MyProcurementsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/my/procurements");

  const { settlementId } = session;
  const now = new Date();
  await autoCloseExpiredProcurements(prisma, now);

  const settlement = settlementId
    ? await prisma.settlement.findUnique({
        where: { id: String(settlementId) },
        include: { region: true },
      })
    : null;

  const procurements = settlementId
    ? await prisma.procurement.findMany({
        where: {
          settlementId: String(settlementId),
          status: "OPEN",
          deadlineAt: { gt: now },
        },
        include: {
          supplier: true,
          pickupPoint: true,
          settlement: { include: { region: true } },
          orders: {
            where: { status: "SUBMITTED" },
            include: { items: true },
          },
        },
        orderBy: { deadlineAt: "asc" },
      })
    : [];

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Доступные закупки"
        title="Закупки по вашему населённому пункту"
        description="Показаны открытые закупки для населённого пункта, привязанного к вашей учётной записи."
        meta={
          settlementId ? (
            <div className="rounded-[0.9rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-left md:text-right">
              <div className="text-xs text-[color:var(--cb-text-soft)]">Ваш населённый пункт</div>
              <div className="mt-1 text-base font-semibold text-[color:var(--cb-text)]">
                {settlement?.name ?? "Привязан"}
              </div>
              {settlement?.region?.name && (
                <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                  {settlement.region.name}
                </div>
              )}
              <div className="mt-2 text-xs text-[color:var(--cb-text-soft)]">
                Открытых закупок: {procurements.length}
              </div>
            </div>
          ) : null
        }
      />

      {!settlementId && (
        <InlineMessage type="warning">
          Ваш аккаунт не привязан к населённому пункту. Обратитесь к администратору.
        </InlineMessage>
      )}



      {procurements.length === 0 && settlementId && (
        <div className="cb-panel-strong rounded-[1.1rem]">
          <EmptyState
            title="Нет активных закупок"
            description="Для вашего населённого пункта сейчас нет открытых закупок."
          />
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {procurements.map((procurement) => {
          const submittedTotal = procurement.orders.reduce(
            (sum, order) =>
              sum + order.items.reduce((itemSum, item) => itemSum + item.qty * item.price, 0),
            0
          );
          const progress =
            procurement.minTotalSum > 0
              ? Math.min(100, Math.round((submittedTotal / procurement.minTotalSum) * 100))
              : null;
          const deadlinePassed = new Date() > new Date(procurement.deadlineAt);

          return (
            <article
              key={procurement.id}
              className="cb-panel-strong rounded-[1rem] p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-2xl">
                  <div className="text-lg font-semibold text-[color:var(--cb-text)]">
                    {procurement.title}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                    {procurement.supplier.name} · {procurement.pickupPoint.name}
                    {procurement.pickupPoint.address && (
                      <span className="text-[color:var(--cb-text-faint)]"> — {procurement.pickupPoint.address}</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                    Населённый пункт: {procurement.settlement.name}
                    {procurement.settlement.region?.name
                      ? ` · ${procurement.settlement.region.name}`
                      : ""}
                  </div>
                </div>

                <Link
                  href={`/p/${procurement.inviteCode}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-3 py-2 text-sm font-medium text-white shadow-[var(--cb-shadow-xs)] hover:bg-[color:var(--cb-accent-strong)]"
                >
                  Открыть
                </Link>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-sm">
                  <div className="text-xs text-[color:var(--cb-text-soft)]">Дедлайн</div>
                  <div
                    className={`mt-1.5 font-medium ${
                      deadlinePassed ? "text-rose-700" : "text-[color:var(--cb-text)]"
                    }`}
                  >
                    {new Date(procurement.deadlineAt).toLocaleString("ru-RU")}
                  </div>
                </div>

                <div className="rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-sm">
                  <div className="text-xs text-[color:var(--cb-text-soft)]">Минимальная сумма</div>
                  <div className="mt-1.5 font-medium text-[color:var(--cb-text)]">
                    {procurement.minTotalSum.toLocaleString("ru-RU")} ₽
                  </div>
                </div>

                <div className="rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-sm">
                  <div className="text-xs text-[color:var(--cb-text-soft)]">Текущий сбор</div>
                  <div className="mt-1.5 font-medium text-[color:var(--cb-text)]">
                    {submittedTotal.toLocaleString("ru-RU")} ₽
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--cb-text-soft)]">
                    {progress !== null ? `${progress}% от порога` : "Без порога"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--cb-text-soft)]">
                <span className="rounded-md border border-[color:var(--cb-line)] bg-white px-2.5 py-1">
                  {procurement.orders.length} подтверждённых заявок
                </span>
                <span className="rounded-md border border-[color:var(--cb-line)] bg-white px-2.5 py-1">
                  Пункт выдачи: {procurement.pickupPoint.name}
                  {procurement.pickupPoint.address && ` — ${procurement.pickupPoint.address}`}
                </span>
              </div>

              {progress !== null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(var(--cb-accent-rgb),0.12)]">
                  <div
                    className="h-1.5 rounded-full bg-[color:var(--cb-accent)] animate-progress"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {procurement.pickupWindowStart && (
                <InlineMessage type="info" className="mt-3">
                  Выдача:{" "}
                  <span className="font-medium">
                    {new Date(procurement.pickupWindowStart).toLocaleString("ru-RU")}
                    {procurement.pickupWindowEnd &&
                      ` — ${new Date(procurement.pickupWindowEnd).toLocaleString("ru-RU")}`}
                  </span>
                  {procurement.pickupInstructions && (
                    <span className="ml-2 text-sky-700">{procurement.pickupInstructions}</span>
                  )}
                </InlineMessage>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
