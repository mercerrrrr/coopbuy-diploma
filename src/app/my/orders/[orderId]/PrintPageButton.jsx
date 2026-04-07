"use client";

import { Printer } from "@phosphor-icons/react";

export function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--cb-shadow-xs)] hover:bg-[color:var(--cb-accent-strong)]"
    >
      <Printer size={16} />
      Печать / сохранить как PDF
    </button>
  );
}
