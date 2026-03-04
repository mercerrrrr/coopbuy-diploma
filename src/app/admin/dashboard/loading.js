export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-5 animate-pulse">
      <div className="h-8 w-48 bg-zinc-200 rounded" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="h-4 w-32 bg-zinc-200 rounded" />
            <div className="h-2 w-full bg-zinc-100 rounded-full" />
            <div className="h-3 w-20 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
