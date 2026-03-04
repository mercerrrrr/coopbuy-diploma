import Link from "next/link";
import { login } from "./actions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6 space-y-4 mt-16">
      <h1 className="text-2xl font-semibold">Войти</h1>
      {error === "forbidden" && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          Недостаточно прав доступа.
        </p>
      )}
      <LoginForm action={login} next={next || "/"} />
      <p className="text-sm text-zinc-500 text-center">
        Нет аккаунта?{" "}
        <Link
          href={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="underline hover:text-zinc-900"
        >
          Зарегистрироваться
        </Link>
      </p>
    </main>
  );
}
