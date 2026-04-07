"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

export function SearchInput({ value, onChange, placeholder = "Поиск...", className = "" }) {
  return (
    <div className={`group relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center text-[color:var(--cb-text-faint)]">
        <MagnifyingGlass size={14} weight="bold" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-[color:var(--cb-line-strong)] bg-white py-2 pl-9 pr-3 text-sm text-[color:var(--cb-text)] outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)] focus:ring-2 focus:ring-[rgba(var(--cb-accent-rgb),0.08)]"
      />
    </div>
  );
}
