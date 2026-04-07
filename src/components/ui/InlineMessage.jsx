const STYLES = {
  success: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
  error: "border-rose-200 bg-rose-50/92 text-rose-800",
  warning: "border-amber-200 bg-amber-50/92 text-amber-900",
  info: "border-sky-200 bg-sky-50/92 text-sky-900",
  neutral: "border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] text-[color:var(--cb-text-soft)]",
};

export function InlineMessage({ type = "info", className = "", children }) {
  return (
    <div
      className={`rounded-[0.8rem] border px-3.5 py-2.5 text-sm leading-6 ${STYLES[type] ?? STYLES.info} ${className}`}
    >
      {children}
    </div>
  );
}
