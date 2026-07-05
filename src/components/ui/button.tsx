import Link from "next/link";

/*
 * Buttons (DESIGN.md §5). Hard corners, Chakra Petch label type. Primary = cyan
 * fill; secondary = ghost with steel-blue border. Renders an <a> (via next/link)
 * when `href` is passed, otherwise a <button>.
 */

type Variant = "primary" | "secondary" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 px-6 py-3 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-150 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-signal-cyan text-void-navy hover:bg-live-cyan active:bg-steel-blue disabled:bg-ledger-teal disabled:text-muted-ink",
  secondary:
    "border border-steel-blue bg-transparent text-signal-cyan hover:bg-elevated-ledger hover:text-live-cyan disabled:border-elevated-ledger disabled:text-muted-ink",
  // Critical/destructive actions. Filled stamp-red + white text (4.5:1) reads
  // correctly on Ledger-Teal panels, where raw red text fails (DESIGN.md §2).
  danger:
    "bg-stamp-red text-case-file-white hover:brightness-110 active:brightness-90 disabled:bg-ledger-teal disabled:text-muted-ink disabled:hover:brightness-100",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
