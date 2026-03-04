export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-5 animate-pulse">
      <div className="h-4 w-32 bg-zinc-200 rounded" />
      <div className="h-8 w-64 bg-zinc-200 rounded" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-3">
          <div className="h-4 w-40 bg-zinc-200 rounded" />
          <div className="h-3 w-full bg-zinc-100 rounded" />
          <div className="h-3 w-3/4 bg-zinc-100 rounded" />
        </div>
      ))}
    </main>
  );
}
