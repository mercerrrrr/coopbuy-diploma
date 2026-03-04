import Link from "next/link";
import { prisma } from "@/lib/db";
import { register } from "./actions";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({ searchParams }) {
  const { next } = await searchParams;
  const settlements = await prisma.settlement.findMany({
    include: { region: true },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <main className="mx-auto max-w-sm p-6 space-y-4 mt-16">
      <h1 className="text-2xl font-semibold">Регистрация</h1>
      <RegisterForm action={register} settlements={settlements} next={next ?? ""} />
      <p className="text-sm text-zinc-500 text-center">
        Уже есть аккаунт?{" "}
        <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline hover:text-zinc-900">
          Войти
        </Link>
      </p>
    </main>
  );
}
