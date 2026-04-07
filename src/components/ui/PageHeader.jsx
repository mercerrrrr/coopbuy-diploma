export function PageHeader({
  eyebrow,
  title,
  description,
  actions = null,
  meta = null,
  className = "",
}) {
  return (
    <section className={`cb-panel-strong rounded-[1.1rem] px-4 py-4 md:px-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-[74ch]">
          {eyebrow && <div className="cb-kicker">{eyebrow}</div>}
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--cb-text)] md:text-[1.9rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[66ch] text-sm leading-6 text-[color:var(--cb-text-soft)]">
              {description}
            </p>
          )}
        </div>

        {(actions || meta) && (
          <div className="flex w-full flex-col gap-2.5 md:w-auto md:min-w-[13rem] md:items-end">
            {meta}
            {actions && <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
