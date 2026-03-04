const VARIANTS = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-zinc-100 text-zinc-600",
  info: "bg-sky-100 text-sky-800",
  primary: "bg-indigo-100 text-indigo-700",
};

export function Badge({ variant = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VARIANTS[variant] ?? VARIANTS.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
