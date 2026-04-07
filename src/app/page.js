import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { logoutAction } from "@/lib/logoutAction";

const capabilityTiles = [
  {
    title: "Публикация закупок",
    description: "Создание закупки, контроль порога сбора, ссылка для жителей и привязка к точке выдачи.",
  },
  {
    title: "Исполнение заказов",
    description: "Оплата, приёмка, формирование документов и журнал действий внутри одного рабочего процесса.",
  },
  {
    title: "Личный кабинет жителя",
    description: "Просмотр доступных закупок, оформление заказов, уведомления, квитанции и QR-код для выдачи.",
  },
];

const workflow = [
  "Администратор или оператор открывает закупку и задаёт параметры сбора.",
  "Жители оформляют заказы по своей территории и получают уведомления о статусах.",
  "После поставки система поддерживает приёмку, выдачу и выпуск отчётных документов.",
];

function getPrimaryHref(role) {
  if (role === "ADMIN" || role === "OPERATOR") return "/admin/dashboard";
  if (role === "RESIDENT") return "/my/procurements";
  return "/auth/register";
}

function getPrimaryLabel(role) {
  if (role === "ADMIN" || role === "OPERATOR") return "Перейти в систему";
  if (role === "RESIDENT") return "Открыть закупки";
  return "Зарегистрироваться";
}

export default async function HomePage() {
  const session = await getSession();
  const roleLabel = session ? ROLE_LABELS[session.role] ?? session.role : "Гостевой доступ";
  const primaryHref = getPrimaryHref(session?.role);
  const primaryLabel = getPrimaryLabel(session?.role);

  return (
    <main className="cb-shell space-y-4 py-3">
      <PageHeader
        eyebrow="CoopBuy / организация совместных закупок"
        title="Информационная система организации совместных закупок"
        description="Система предназначена для публикации закупок, оформления заказов жителями, контроля оплаты, выдачи и формирования отчётных документов."
        meta={
          <div className="rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3.5 py-3 text-left md:text-right">
            <div className="cb-kicker">Текущий доступ</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 md:justify-end">
              <span className="text-sm font-medium text-[color:var(--cb-text)]">
                {session?.fullName ?? "Пользователь не авторизован"}
              </span>
              <Badge variant="neutral">{roleLabel}</Badge>
            </div>
          </div>
        }
        actions={
          <>
            <Link
              href={primaryHref}
              className="inline-flex min-h-10 items-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.18)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
            >
              {primaryLabel}
            </Link>
            {session ? (
              <form action={logoutAction}>
                <Button type="submit" variant="secondary" size="md">
                  Выйти
                </Button>
              </form>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex min-h-10 items-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
              >
                Войти
              </Link>
            )}
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="cb-panel-strong rounded-[1.25rem] p-4 md:p-5">
          <div className="cb-kicker">Назначение системы</div>
          <div className="mt-3 grid gap-3">
            {capabilityTiles.map((item) => (
              <div
                key={item.title}
                className="rounded-[1rem] border border-[color:var(--cb-line)] bg-white px-4 py-3.5"
              >
                <div className="text-sm font-semibold text-[color:var(--cb-text)]">{item.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="cb-panel-strong rounded-[1.25rem] p-4 md:p-5">
          <div className="cb-kicker">Основной процесс</div>
          <div className="mt-3 space-y-3">
            {workflow.map((item, index) => (
              <div
                key={item}
                className="grid grid-cols-[2rem_1fr] items-start gap-3 rounded-[1rem] border border-[color:var(--cb-line)] bg-white px-4 py-3.5"
              >
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--cb-accent-soft)] text-sm font-semibold text-[color:var(--cb-accent-strong)]">
                  {index + 1}
                </div>
                <div className="text-sm leading-relaxed text-[color:var(--cb-text-soft)]">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="cb-panel-strong rounded-[1.1rem] p-4">
          <div className="cb-kicker">Житель</div>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
            Доступ к закупкам своей территории, оформлению заказов, уведомлениям и документам.
          </p>
        </div>
        <div className="cb-panel-strong rounded-[1.1rem] p-4">
          <div className="cb-kicker">Оператор</div>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
            Работа с оплатой и выдачей заказов в закреплённой точке выдачи.
          </p>
        </div>
        <div className="cb-panel-strong rounded-[1.1rem] p-4">
          <div className="cb-kicker">Администратор</div>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
            Управление закупками, поставщиками, территориями, справочниками и отчётами.
          </p>
        </div>
      </section>
    </main>
  );
}
