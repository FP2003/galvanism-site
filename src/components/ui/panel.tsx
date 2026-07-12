/*
 * Ops Terminal container (DESIGN.md §5). Ledger-teal surface, hard corners, flat
 * (tonal depth only — no shadow). Header carries a title and optional right-side
 * meta, separated by a thin rule.
 */
export function Panel({
  title,
  meta,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col bg-ledger-teal ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-elevated-ledger px-5 py-3">
          <h2 className="min-w-0 break-words font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.06em] text-case-file-white">
            {title}
          </h2>
          {meta && <div className="shrink-0">{meta}</div>}
        </header>
      )}
      <div className={`flex-1 p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
