import Link from "next/link";
import { prisma } from "@/lib/db";
import { Storefront } from "@phosphor-icons/react/ssr";
import { register } from "./actions";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({ searchParams }) {
  const { next } = await searchParams;
  const settlements = await prisma.settlement.findMany({
    include: { region: true },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <main className="cb-auth-backdrop">
      <div className="w-full max-w-[30rem]">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--cb-accent-soft)]">
            <Storefront size={28} weight="fill" className="text-[color:var(--cb-accent)]" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)]">
            Регистрация участника
          </h1>
          <p className="mt-2 text-sm text-[color:var(--cb-text-soft)]">
            CoopBuy — система совместных закупок
          </p>
        </div>

        <section className="cb-panel-strong rounded-2xl p-6 md:p-8" style={{ boxShadow: "var(--cb-shadow)" }}>
          <RegisterForm action={register} settlements={settlements} next={next ?? ""} />

          <div className="mt-6 border-t border-[color:var(--cb-line)] pt-5 text-center text-sm text-[color:var(--cb-text-soft)]">
            Уже есть аккаунт?{" "}
            <Link
              href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-medium text-[color:var(--cb-accent)] hover:text-[color:var(--cb-accent-strong)]"
            >
              Войти
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
