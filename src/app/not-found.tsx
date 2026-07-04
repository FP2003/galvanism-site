import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandMark size={56} className="text-steel-blue" />
      <p className="mt-6 font-[family-name:var(--font-jetbrains)] text-xs uppercase tracking-[0.2em] text-stamp-red">
        Error 404 · Record not found
      </p>
      <h1 className="mt-3 max-w-lg text-balance font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-tight tracking-[0.02em] text-case-file-white sm:text-4xl">
        No file matches that designation
      </h1>
      <p className="mt-3 max-w-md text-pretty text-sm text-muted-ink">
        The requested record is missing, sealed, or has been purged from the
        Regiment Foxtrot registry.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-2 bg-signal-cyan px-6 py-3 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-void-navy transition-colors hover:bg-live-cyan"
      >
        Return to Command
      </Link>
    </main>
  );
}
