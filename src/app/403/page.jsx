import Link from "next/link";
import { ShieldSlash } from "@phosphor-icons/react/ssr";

export const metadata = { title: "Доступ запрещён — CoopBuy" };

export default function ForbiddenPage() {
  return (
    <main className="cb-shell py-6">
      <section className="cb-panel-strong rounded-[1.25rem] px-4 py-8 text-center md:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1rem] border border-rose-200 bg-rose-50 text-rose-700">
          <ShieldSlash size={24} weight="bold" />
        </div>
        <div className="mt-4 cb-kicker">CoopBuy / ограничение доступа</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--cb-text)]">
          Доступ к странице запрещён
        </h1>
        <p className="mx-auto mt-2 max-w-[36rem] text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
          У текущей учётной записи отсутствуют права для просмотра этой страницы.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.18)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
          >
            На главную
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex min-h-10 items-center rounded-md border border-[color:var(--cb-line-strong)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
          >
            Войти под другой учётной записью
          </Link>
        </div>
      </section>
    </main>
  );
}
