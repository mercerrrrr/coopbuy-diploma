"use client";

const VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm",
  secondary: "bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 shadow-sm",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};

const SIZES = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg gap-1",
  md: "px-3.5 py-2 text-sm rounded-xl gap-1.5",
  lg: "px-5 py-2.5 text-base rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
