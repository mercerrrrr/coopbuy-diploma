import Link from "next/link";

export function Pager({ page, totalPages, baseUrl, query = {} }) {
  if (totalPages <= 1) return null;

  function href(p) {
    const params = new URLSearchParams({ ...query, page: String(p) });
    return `${baseUrl}?${params.toString()}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const buttonClass =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]";
  const disabledClass =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] px-3 py-2 text-sm text-[color:var(--cb-text-faint)]";

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {hasPrev ? (
        <Link href={href(page - 1)} className={buttonClass}>
          Назад
        </Link>
      ) : (
        <span className={disabledClass}>
          Назад
        </span>
      )}

      <span
        aria-current="page"
        className="rounded-md border border-[color:var(--cb-line)] bg-white px-3 py-2 text-sm text-[color:var(--cb-text)]"
      >
        {page} / {totalPages}
      </span>

      {hasNext ? (
        <Link href={href(page + 1)} className={buttonClass}>
          Вперёд
        </Link>
      ) : (
        <span className={disabledClass}>
          Вперёд
        </span>
      )}
    </div>
  );
}
