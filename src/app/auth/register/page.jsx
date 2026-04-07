import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { register } from "./actions";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({ searchParams }) {
  const { next } = await searchParams;
  const settlements = await prisma.settlement.findMany({
    include: { region: true },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <main className="cb-shell py-6">
      <section className="mx-auto max-w-[44rem] cb-panel-strong rounded-[1.1rem] p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Badge variant="neutral">CoopBuy</Badge>
          <Badge variant="neutral">Регистрация</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
          Регистрация участника
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cb-text-soft)]">
          После регистрации будут доступны закупки по выбранному населённому
          пункту, оформление заказов и получение уведомлений. Для пилотного
          сценария основным выбором является именно населённый пункт.
        </p>

        <div className="mt-5">
          <RegisterForm action={register} settlements={settlements} next={next ?? ""} />
        </div>

        <div className="mt-5 border-t border-[color:var(--cb-line)] pt-4 text-sm text-[color:var(--cb-text-soft)]">
          Уже есть аккаунт?{" "}
          <Link
            href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-medium text-[color:var(--cb-accent)] hover:text-[color:var(--cb-accent-strong)]"
          >
            Войти
          </Link>
        </div>

        <div className="mt-4 rounded-[0.9rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--cb-text-soft)]">
          Укажите корректный населённый пункт. Региональная модель остаётся в
          архитектуре, но в пилоте ключевой выбор для жителя делается на уровне
          settlement.
        </div>
      </section>
    </main>
  );
}
