export function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {icon && (
        <div className="text-zinc-300 mb-4">{icon}</div>
      )}
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-zinc-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
