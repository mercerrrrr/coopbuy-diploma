import { UsersThree, UserGear, UserPlus } from "@phosphor-icons/react/ssr";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/guards";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ROLE_LABELS } from "@/lib/constants";
import { createOperator, createResident } from "./actions";
import { CreateOperatorForm, CreateResidentForm } from "./ClientForms";

function formatSettlement(settlement) {
  if (!settlement) return "Не указан";
  if (!settlement.region?.name) return settlement.name;
  return `${settlement.name} · ${settlement.region.name}`;
}

export default async function AdminUsersPage() {
  await assertAdmin();

  const [users, settlements, pickupPoints] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        settlement: {
          include: {
            region: true,
          },
        },
        pickupPoint: {
          include: {
            settlement: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    }),
    prisma.settlement.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        region: true,
      },
    }),
    prisma.pickupPoint.findMany({
      orderBy: [{ settlement: { name: "asc" } }, { name: "asc" }],
      include: {
        settlement: {
          include: {
            region: true,
          },
        },
      },
    }),
  ]);

  const groupedUsers = {
    ADMIN: users.filter((user) => user.role === "ADMIN"),
    OPERATOR: users.filter((user) => user.role === "OPERATOR"),
    RESIDENT: users.filter((user) => user.role === "RESIDENT"),
  };

  return (
    <main className="cb-shell space-y-4 py-1">
      <PageHeader
        eyebrow="Операционный центр / пользователи"
        title="Пользователи и роли"
        description="Минимальный модуль управления доступом для пилота: список пользователей и быстрое создание операторов и жителей без сложного редактирования."
        meta={
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard label="Всего" value={users.length} />
            <StatCard label="Операторы" value={groupedUsers.OPERATOR.length} variant="info" />
            <StatCard label="Жители" value={groupedUsers.RESIDENT.length} variant="primary" />
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent-strong)]">
                <UserGear size={18} />
              </span>
              <div>
                <CardTitle>Создать оператора</CardTitle>
                <p className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                  Оператор привязывается к конкретному пункту выдачи.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <CreateOperatorForm action={createOperator} pickupPoints={pickupPoints} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent-strong)]">
                <UserPlus size={18} />
              </span>
              <div>
                <CardTitle>Создать жителя</CardTitle>
                <p className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
                  Житель получает доступ к закупкам своего населённого пункта.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <CreateResidentForm action={createResident} settlements={settlements} />
          </CardBody>
        </Card>
      </section>

      {users.length === 0 ? (
        <div className="cb-panel-strong rounded-[1.1rem]">
          <EmptyState
            icon={<UsersThree size={34} />}
            title="Пользователей пока нет"
            description="Создайте первого оператора или жителя через формы выше."
          />
        </div>
      ) : (
        <section className="grid gap-4">
          {[
            {
              role: "ADMIN",
              title: "Администраторы",
              description: "Полный доступ к системе и настройкам.",
            },
            {
              role: "OPERATOR",
              title: "Операторы",
              description: "Работают в рамках своего ПВЗ и связанного населённого пункта.",
            },
            {
              role: "RESIDENT",
              title: "Жители",
              description: "Оформляют заявки и отслеживают свои заказы.",
            },
          ].map((section) => {
            const roleUsers = groupedUsers[section.role];

            return (
              <Card key={section.role}>
                <CardHeader className="items-start">
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <p className="mt-1 text-sm text-[color:var(--cb-text-soft)]">{section.description}</p>
                  </div>
                  <Badge variant="neutral">{roleUsers.length}</Badge>
                </CardHeader>
                <CardBody>
                  {roleUsers.length === 0 ? (
                    <EmptyState
                      title="Пока пусто"
                      description={`Пользователи с ролью «${ROLE_LABELS[section.role] ?? section.role}» ещё не созданы.`}
                    />
                  ) : (
                    <div className="overflow-hidden rounded-[1rem] border border-[color:var(--cb-line)]">
                      <div className="grid grid-cols-1 divide-y divide-[color:var(--cb-line)] bg-white">
                        {roleUsers.map((user) => (
                          <article
                            key={user.id}
                            className="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-[color:var(--cb-text)]">{user.fullName}</div>
                              <div className="mt-1 break-all text-sm text-[color:var(--cb-text-soft)]">{user.email}</div>
                              {user.phone && (
                                <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">{user.phone}</div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--cb-text-faint)]">
                                Населённый пункт
                              </div>
                              <div className="mt-1 text-sm text-[color:var(--cb-text)]">
                                {formatSettlement(user.settlement)}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--cb-text-faint)]">
                                Пункт выдачи
                              </div>
                              <div className="mt-1 text-sm text-[color:var(--cb-text)]">
                                {user.pickupPoint?.name ?? "Не привязан"}
                              </div>
                              {user.pickupPoint?.address && (
                                <div className="mt-1 text-xs text-[color:var(--cb-text-faint)]">
                                  {user.pickupPoint.address}
                                </div>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
