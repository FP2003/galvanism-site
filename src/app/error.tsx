"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

// Route-segment error boundary. Catches anything an uncaught render or server
// action throws below the root layout — most of this app's forms post through
// useActionState with no per-component network-failure handling of their own
// (a handful, like BioEditor/ResourceTracker, wrap their own try/catch; this is
// the safety net for everyone else), so without this the failure would otherwise
// surface as Next's unbranded default error screen. `reset` re-renders the
// segment in place; nothing on the underlying sheet has been touched, since the
// failure happened before any mutation could be confirmed.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandMark size={56} className="text-stamp-red" />
      <p className="mt-6 font-[family-name:var(--font-jetbrains)] text-xs uppercase tracking-[0.2em] text-stamp-red">
        System fault · Uplink interrupted
      </p>
      <h1 className="mt-3 max-w-lg text-balance font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-tight tracking-[0.02em] text-case-file-white sm:text-4xl">
        Connection to Command lost
      </h1>
      <p className="mt-3 max-w-md text-pretty text-sm text-muted-ink">
        The terminal couldn&apos;t complete that request. Check your connection
        and try again — nothing on your sheet was changed.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex items-center gap-2 bg-signal-cyan px-6 py-3 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-void-navy transition-colors hover:bg-live-cyan"
      >
        <RotateCcw size={15} aria-hidden="true" />
        Retry
      </button>
    </main>
  );
}
