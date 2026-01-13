import Link from "next/link";
import { prisma } from "@/lib/db";
import { createProcurement, closeProcurement } from "./actions";
import { CreateProcurementForm } from "./ClientForms";

export default async function ProcurementsPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, name: true, minOrderSum: true },
  });

  const settlementsRaw = await prisma.settlement.findMany({
    orderBy: [{ name: "asc" }],
    include: { region: true },
  });

  const settlements = settlementsRaw.map((s) => ({
    id: s.id,
    label: `${s.region.name} • ${s.name}`,
  }));

  const pickupPointsRaw = await prisma.pickupPoint.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { settlement: { include: { region: true } } },
  });

  const pickupPoints = pickupPointsRaw.map((p) => ({
    id: p.id,
    settlementId: p.settlementId,
    label: `${p.name} — ${p.settlement.region.name} • ${p.settlement.name}`,
  }));

  const procurements = await prisma.procurement.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      supplier: true,
      settlement: { include: { region: true } },
      pickupPoint: true,
      orders: { include: { items: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Закупки</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Админ создаёт закупку → система генерирует ссылку-приглашение → участники добавляют товары.
      </p>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-medium">Создать закупку</div>
        <CreateProcurementForm
          action={createProcurement}
          suppliers={suppliers}
          settlements={settlements}
          pickupPoints={pickupPoints}
        />
      </section>

      <div className="mt-6 space-y-4">
        {procurements.map((p) => {
          const inviteUrl = `/p/${p.inviteCode}`;
          const ordersCount = p.orders.length;
          const itemsCount = p.orders.reduce((acc, o) => acc + o.items.length, 0);

          return (
            <section key={p.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">{p.title}</h2>
                  <div className="mt-1 text-sm text-zinc-600">
                    Поставщик: <span className="font-medium">{p.supplier.name}</span>
                    {" • "}
                    {p.settlement.region.name} • {p.settlement.name}
                    {" • "}
                    {p.pickupPoint.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Дедлайн: {new Date(p.deadlineAt).toLocaleString("ru-RU")}
                    {" • "}Мин. сбор: {p.minTotalSum} ₽
                    {" • "}Статус: {p.status}
                  </div>
                  <div className="mt-2 text-sm">
                    Заявок: <span className="font-medium">{ordersCount}</span>, позиций:{" "}
                    <span className="font-medium">{itemsCount}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={inviteUrl}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Открыть ссылку
                  </Link>

                  <form action={closeProcurement}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                      Закрыть
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Invite: <span className="font-mono">{inviteUrl}</span>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
