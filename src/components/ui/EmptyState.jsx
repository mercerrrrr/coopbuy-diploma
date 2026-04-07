export function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 py-8 text-center ${className}`}>
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[color:var(--cb-line)] bg-[color:var(--cb-bg-soft)] text-[color:var(--cb-text-soft)]">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold tracking-[-0.02em] text-[color:var(--cb-text)]">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-[color:var(--cb-text-soft)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
