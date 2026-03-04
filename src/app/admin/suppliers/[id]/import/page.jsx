import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CsvImportClient } from "./CsvImportClient";

export default async function ImportPage({ params }) {
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!supplier) notFound();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/suppliers" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Поставщики
        </Link>
        <span className="text-zinc-300">|</span>
        <h1 className="text-xl font-semibold">Импорт прайс-листа</h1>
        <span className="rounded-full border bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
          {supplier.name}
        </span>
      </div>

      <CsvImportClient supplierId={supplier.id} />
    </main>
  );
}
