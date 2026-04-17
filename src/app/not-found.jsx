import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";

export default function NotFound() {
  return (
    <main className="cb-shell py-4">
      <section className="cb-panel-strong rounded-[1.35rem] px-4 py-6 text-center md:px-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent)]">
          <MagnifyingGlass size={20} weight="bold" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--cb-text)]">
          Экран не найден
        </h1>
        <p className="mx-auto mt-2 max-w-[34rem] text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
          Ссылка может быть устаревшей или недоступной для вашей роли. Вернитесь на главный экран и откройте нужный раздел заново.
        </p>
        <div className="mt-5">
          <Link
            href="/auth/login"
            className="inline-flex min-h-10 items-center rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.18)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--cb-accent-strong)]"
          >
            Вернуться ко входу
          </Link>
        </div>
      </section>
    </main>
  );
}
