import styles from "./registry-terminal.module.css";

export function RegistryTerminalFrame({
  variant,
  systemLabel,
  meta,
  status,
  children,
  className = "",
}: {
  variant: "index" | "record";
  systemLabel: React.ReactNode;
  meta?: React.ReactNode;
  status: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.frame} ${className}`}>
      <div className={styles.surface}>
        <header className="grid border-b border-elevated-ledger bg-void-navy sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
            <span className="size-2 shrink-0 bg-steel-blue" aria-hidden="true" />
            <span className="truncate font-[family-name:var(--font-orbitron)] text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-case-file-white">
              {systemLabel}
            </span>
          </div>

          <div className="flex min-w-0 items-stretch border-t border-elevated-ledger sm:border-l sm:border-t-0">
            {meta !== undefined ? (
              <div className="flex min-w-0 flex-1 items-center px-4 py-2 font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase tracking-[0.06em] text-muted-ink sm:flex-none sm:border-r sm:border-elevated-ledger sm:py-3">
                {meta}
              </div>
            ) : null}
            <div className="flex shrink-0 items-center px-4 py-2 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-case-file-white sm:py-3">
              {status}
            </div>
          </div>
        </header>

        <div className={variant === "record" ? styles.recordReveal : undefined}>
          {children}
        </div>
      </div>

      <span
        className="pointer-events-none absolute left-0 top-0 h-5 w-10 border-l-2 border-t-2 border-steel-blue"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute bottom-0 right-0 h-5 w-10 border-b-2 border-r-2 border-steel-blue"
        aria-hidden="true"
      />
    </section>
  );
}
