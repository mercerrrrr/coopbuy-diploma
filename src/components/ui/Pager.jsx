import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-side pager that builds query-string links.
 *
 * Props:
 *   page        — current page number (1-based)
 *   totalPages  — total number of pages
 *   baseUrl     — pathname (e.g. "/admin/dashboard")
 *   query       — plain object of OTHER query params to preserve (optional)
 */
export function Pager({ page, totalPages, baseUrl, query = {} }) {
  if (totalPages <= 1) return null;

  function href(p) {
    const params = new URLSearchParams({ ...query, page: String(p) });
    return `${baseUrl}?${params.toString()}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {hasPrev ? (
        <Link
          href={href(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 shadow-sm transition-colors"
        >
          <ChevronLeft size={14} />
          Назад
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-300 cursor-not-allowed">
          <ChevronLeft size={14} />
          Назад
        </span>
      )}

      <span className="px-3 py-1.5 text-sm text-zinc-500">
        {page} / {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={href(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 shadow-sm transition-colors"
        >
          Вперёд
          <ChevronRight size={14} />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-300 cursor-not-allowed">
          Вперёд
          <ChevronRight size={14} />
        </span>
      )}
    </div>
  );
}
