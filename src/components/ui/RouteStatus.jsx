"use client";

import Link from "next/link";
import { ArrowClockwise, House, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

export function PageLoadingState({ title = "Загружаем данные", description = "Подготавливаем интерфейс и актуальный статус." }) {
  return (
    <main className="cb-shell py-4">
      <div className="cb-panel-strong animate-pulse rounded-[1.35rem] px-4 py-5 md:px-5">
        <div className="h-3 w-32 rounded-full bg-[color:rgba(var(--cb-accent-rgb),0.12)]" />
        <div className="mt-4 h-8 w-64 rounded-full bg-[color:rgba(var(--cb-accent-rgb),0.12)]" />
        <div className="mt-3 h-4 max-w-[32rem] rounded-full bg-[color:var(--cb-line)]" />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="rounded-[1.1rem] border border-[color:var(--cb-line)] bg-white/80 px-4 py-4"
            >
              <div className="h-3 w-28 rounded-full bg-[color:var(--cb-line)]" />
              <div className="mt-4 h-5 w-36 rounded-full bg-[color:rgba(var(--cb-accent-rgb),0.12)]" />
              <div className="mt-3 h-3 w-full rounded-full bg-[color:var(--cb-line)]" />
            </div>
          ))}
        </div>
      </div>

      <div className="sr-only">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </main>
  );
}

export function RouteErrorState({
  title = "Не удалось открыть экран",
  description = "Попробуйте обновить страницу. Если проблема повторится, вернитесь на предыдущий экран и повторите действие.",
  reset,
}) {
  return (
    <main className="cb-shell py-4">
      <section className="cb-panel-strong rounded-[1.35rem] px-4 py-6 text-center md:px-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[1rem] border border-amber-200 bg-amber-50 text-amber-700">
          <WarningCircle size={22} weight="fill" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--cb-text)]">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-[42rem] text-sm leading-relaxed text-[color:var(--cb-text-soft)]">
          {description}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {typeof reset === "function" && (
            <Button type="button" onClick={() => reset()} size="md">
              <ArrowClockwise size={16} weight="bold" />
              Повторить
            </Button>
          )}
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]"
          >
            <House size={16} weight="fill" />
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
