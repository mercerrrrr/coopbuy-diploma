export function Card({ className = "", children }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children }) {
  return (
    <h2 className={`text-sm font-semibold text-zinc-900 ${className}`}>
      {children}
    </h2>
  );
}

export function CardBody({ className = "", children }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

const STAT_VARIANTS = {
  default: "bg-white border-zinc-200",
  success: "bg-emerald-50 border-emerald-200",
  danger: "bg-red-50 border-red-200",
  warning: "bg-amber-50 border-amber-200",
  info: "bg-sky-50 border-sky-200",
  primary: "bg-indigo-50 border-indigo-200",
};

const STAT_VALUE_VARIANTS = {
  default: "text-zinc-900",
  success: "text-emerald-800",
  danger: "text-red-800",
  warning: "text-amber-800",
  info: "text-sky-800",
  primary: "text-indigo-800",
};

const STAT_LABEL_VARIANTS = {
  default: "text-zinc-500",
  success: "text-emerald-600",
  danger: "text-red-500",
  warning: "text-amber-600",
  info: "text-sky-600",
  primary: "text-indigo-600",
};

export function StatCard({ label, value, sub, variant = "default", className = "" }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${STAT_VARIANTS[variant] ?? STAT_VARIANTS.default} ${className}`}
    >
      <div className={`text-xs font-medium ${STAT_LABEL_VARIANTS[variant] ?? STAT_LABEL_VARIANTS.default}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tracking-tight ${STAT_VALUE_VARIANTS[variant] ?? STAT_VALUE_VARIANTS.default}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-xs mt-0.5 ${STAT_LABEL_VARIANTS[variant] ?? STAT_LABEL_VARIANTS.default}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
