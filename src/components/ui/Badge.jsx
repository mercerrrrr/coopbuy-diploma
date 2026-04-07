const VARIANTS = {
  success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border border-amber-200 bg-amber-50 text-amber-800",
  danger: "border border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] text-[color:var(--cb-text-soft)]",
  info: "border border-sky-200 bg-sky-50 text-sky-800",
  primary:
    "border border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent-strong)]",
};

export function Badge({ variant = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.02em] ${VARIANTS[variant] ?? VARIANTS.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
