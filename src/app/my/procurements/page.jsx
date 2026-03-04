import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShoppingCart } from "lucide-react";

export default async function MyProcurementsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/my/procurements");

  const { settlementId } = session;

  const now = new Date();
  await autoCloseExpiredProcurements(prisma, now);

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
          orders: {
            where: { status: "SUBMITTED" },
            include: { items: true },
          },
        },
        orderBy: { deadlineAt: "asc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Активные закупки</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Закупки для вашего населённого пункта
        </p>
      </div>

      {!settlementId && (
        <InlineMessage type="warning">
          Ваш аккаунт не привязан к населённому пункту. Обратитесь к администратору.
        </InlineMessage>
      )}

      {procurements.length === 0 && settlementId && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={<ShoppingCart size={36} />}
            title="Нет активных закупок"
            description="Для вашего населённого пункта сейчас нет открытых закупок"
          />
        </div>
      )}

      {procurements.map((p) => {
        const submittedTotal = p.orders.reduce(
          (sum, o) => sum + o.items.reduce((s, i) => s + i.qty * i.price, 0),
          0
        );
        const progress =
          p.minTotalSum > 0
            ? Math.min(100, Math.round((submittedTotal / p.minTotalSum) * 100))
            : null;
        const deadlinePassed = new Date() > new Date(p.deadlineAt);

        return (
          <div
            key={p.id}
            className="rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-zinc-900">{p.title}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {p.supplier.name} · {p.pickupPoint.name}
                </div>
              </div>
              <Link
                href={`/p/${p.inviteCode}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Перейти →
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>
                Дедлайн:{" "}
                <span
                  className={
                    deadlinePassed
                      ? "text-red-600 font-semibold"
                      : "font-medium text-zinc-700"
                  }
                >
                  {new Date(p.deadlineAt).toLocaleString("ru-RU")}
                </span>
              </span>
              {p.minTotalSum > 0 && (
                <span>
                  Мин. сбор:{" "}
                  <span className="font-medium text-zinc-700">
                    {p.minTotalSum.toLocaleString("ru-RU")} ₽
                  </span>
                  {" · "}Собрано:{" "}
                  <span className="font-medium text-zinc-700">
                    {submittedTotal.toLocaleString("ru-RU")} ₽
                  </span>
                  {progress !== null && (
                    <span className="ml-1 text-indigo-600 font-semibold">({progress}%)</span>
                  )}
                </span>
              )}
            </div>

            {progress !== null && (
              <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-indigo-500 animate-progress"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {p.pickupWindowStart && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Выдача:{" "}
                <span className="font-medium">
                  {new Date(p.pickupWindowStart).toLocaleString("ru-RU")}
                  {p.pickupWindowEnd &&
                    ` — ${new Date(p.pickupWindowEnd).toLocaleString("ru-RU")}`}
                </span>
                {p.pickupInstructions && (
                  <span className="ml-2 text-sky-700">{p.pickupInstructions}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
