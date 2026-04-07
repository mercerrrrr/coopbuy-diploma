export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`overflow-hidden rounded-[1rem] border border-[color:var(--cb-line)] bg-[color:var(--cb-panel-strong)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-[color:var(--cb-line)] px-4 py-3.5 md:px-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children }) {
  return (
    <h2
      className={`text-base font-semibold tracking-[-0.02em] text-[color:var(--cb-text)] ${className}`}
    >
      {children}
    </h2>
  );
}

export function CardBody({ className = "", children, ...props }) {
  return (
    <div className={`px-4 py-4 md:px-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

const STAT_VARIANTS = {
  default: "border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)]",
  success: "border-emerald-200 bg-emerald-50",
  danger: "border-rose-200 bg-rose-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-sky-200 bg-sky-50",
  primary: "border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent-soft)]",
};

const STAT_VALUE_VARIANTS = {
  default: "text-[color:var(--cb-text)]",
  success: "text-emerald-800",
  danger: "text-rose-800",
  warning: "text-amber-800",
  info: "text-sky-800",
  primary: "text-[color:var(--cb-accent-strong)]",
};

const STAT_LABEL_VARIANTS = {
  default: "text-[color:var(--cb-text-soft)]",
  success: "text-emerald-600",
  danger: "text-rose-500",
  warning: "text-amber-600",
  info: "text-sky-600",
  primary: "text-[color:var(--cb-accent)]",
};

export function StatCard({ label, value, sub, variant = "default", className = "" }) {
  return (
    <div
      className={`overflow-hidden rounded-[0.9rem] border px-3.5 py-3 ${STAT_VARIANTS[variant] ?? STAT_VARIANTS.default} ${className}`}
    >
      <div
        className={`text-[0.64rem] font-semibold uppercase tracking-[0.14em] ${STAT_LABEL_VARIANTS[variant] ?? STAT_LABEL_VARIANTS.default}`}
      >
        {label}
      </div>
      <div
        className={`mt-1.5 text-xl font-semibold tracking-[-0.03em] tabular-nums ${STAT_VALUE_VARIANTS[variant] ?? STAT_VALUE_VARIANTS.default}`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-1 text-[0.72rem] ${STAT_LABEL_VARIANTS[variant] ?? STAT_LABEL_VARIANTS.default}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
