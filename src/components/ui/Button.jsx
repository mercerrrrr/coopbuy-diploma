const VARIANTS = {
  primary:
    "border border-[color:rgba(var(--cb-accent-rgb),0.18)] bg-[color:var(--cb-accent)] text-white hover:bg-[color:var(--cb-accent-strong)]",
  secondary:
    "border border-[color:var(--cb-line-strong)] bg-white text-[color:var(--cb-text)] hover:bg-[color:var(--cb-bg-soft)]",
  danger: "border border-rose-200 bg-rose-600 text-white hover:bg-rose-700",
  ghost:
    "border border-transparent bg-transparent text-[color:var(--cb-text-soft)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]",
  success: "border border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700",
};

const SIZES = {
  sm: "rounded-md px-3 py-2 text-xs gap-1.5 min-h-9",
  md: "rounded-md px-3.5 py-2 text-sm gap-2 min-h-10",
  lg: "rounded-md px-4 py-2.5 text-sm gap-2 min-h-11",
};

function LoadingGlyph() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-current"
          style={{
            animation: "cb-pulse 1s ease-in-out infinite",
            animationDelay: `${index * 120}ms`,
            opacity: 0.38,
          }}
        />
      ))}
    </span>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingGlyph />}
      {children}
    </button>
  );
}
