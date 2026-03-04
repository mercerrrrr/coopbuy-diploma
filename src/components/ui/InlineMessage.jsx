const STYLES = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-sky-50 border-sky-200 text-sky-800",
  neutral: "bg-zinc-50 border-zinc-200 text-zinc-700",
};

export function InlineMessage({ type = "info", className = "", children }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${STYLES[type] ?? STYLES.info} ${className}`}>
      {children}
    </div>
  );
}
