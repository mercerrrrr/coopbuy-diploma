import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { LoginForm } from "./LoginForm";
import { login } from "./actions";

export default async function LoginPage({ searchParams }) {
  const { next, error } = await searchParams;

  return (
    <main className="cb-shell py-6">
      <section className="mx-auto max-w-[34rem] cb-panel-strong rounded-[1.1rem] p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Badge variant="neutral">CoopBuy</Badge>
          <Badge variant="neutral">Вход</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
          Вход в систему
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cb-text-soft)]">
          Используйте email и пароль. После авторизации откроется рабочий экран,
          доступный вашей роли.
        </p>

        {error === "forbidden" && (
          <InlineMessage type="error" className="mt-4">
            Недостаточно прав доступа для запрошенной страницы.
          </InlineMessage>
        )}

        <div className="mt-5">
          <LoginForm action={login} next={next || "/"} />
        </div>

        <div className="mt-5 border-t border-[color:var(--cb-line)] pt-4 text-sm text-[color:var(--cb-text-soft)]">
          Нет аккаунта?{" "}
          <Link
            href={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-medium text-[color:var(--cb-accent)] hover:text-[color:var(--cb-accent-strong)]"
          >
            Зарегистрироваться
          </Link>
        </div>

        <div className="mt-4 rounded-[0.9rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--cb-text-soft)]">
          Жители работают с закупками и заказами. Операторы и администраторы
          ведут оплату, выдачу и сопровождение закупок.
        </div>
      </section>
    </main>
  );
}
