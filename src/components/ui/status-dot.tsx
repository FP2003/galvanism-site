/*
 * Live status indicator (DESIGN.md §5). A circle — one of the two sanctioned
 * non-square shapes — beside an uppercase label. Pulse (opacity only) is reserved
 * for genuinely live things; static dots for at-rest states. Reduced-motion is
 * handled globally in globals.css.
 */

type Tone = "live" | "critical" | "neutral";

const dotColor: Record<Tone, string> = {
  live: "bg-signal-cyan",
  critical: "bg-stamp-red",
  neutral: "bg-muted-ink",
};

export function StatusDot({
  tone = "neutral",
  pulse = false,
  className = "",
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${dotColor[tone]} ${
        pulse ? "animate-pulse-live" : ""
      } ${className}`}
      aria-hidden="true"
    />
  );
}

export function StatusLabel({
  tone = "neutral",
  pulse = false,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  // Critical renders as a filled stamp — a colored dot + red text would fail
  // contrast on teal panels (DESIGN.md §2), and a flag reads stronger anyway.
  if (tone === "critical") {
    return (
      <span className="inline-flex items-center bg-stamp-red px-2 py-0.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-bold uppercase tracking-[0.08em] text-case-file-white">
        {children}
      </span>
    );
  }

  const textColor = tone === "live" ? "text-signal-cyan" : "text-muted-ink";
  return (
    <span
      className={`inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] ${textColor}`}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}
