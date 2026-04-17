import Link from "next/link";
import { Storefront } from "@phosphor-icons/react/ssr";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { LoginForm } from "./LoginForm";
import { login } from "./actions";

export default async function LoginPage({ searchParams }) {
  const { next, error } = await searchParams;

  return (
    <main className="cb-auth-backdrop">
      <div className="w-full max-w-[26rem]">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--cb-accent-soft)]">
            <Storefront size={28} weight="fill" className="text-[color:var(--cb-accent)]" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
            Вход в систему
          </h1>
          <p className="mt-2 text-sm text-[color:var(--cb-text-soft)]">
            CoopBuy — система совместных закупок
          </p>
        </div>

        <section className="cb-panel-strong rounded-2xl p-6 md:p-8" style={{ boxShadow: "var(--cb-shadow)" }}>
          {error === "forbidden" && (
            <InlineMessage type="error" className="mb-5">
              Недостаточно прав доступа для запрошенной страницы.
            </InlineMessage>
          )}

          <LoginForm action={login} next={next || ""} />

          <div className="mt-6 border-t border-[color:var(--cb-line)] pt-5 text-center text-sm text-[color:var(--cb-text-soft)]">
            Нет аккаунта?{" "}
            <Link
              href={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-medium text-[color:var(--cb-accent)] hover:text-[color:var(--cb-accent-strong)]"
            >
              Зарегистрироваться
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
