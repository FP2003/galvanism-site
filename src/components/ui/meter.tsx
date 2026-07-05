/*
 * Thin horizontal meter for resources (HP / Energy / Ammo) and tallies. Flat
 * track + fill, hard corners. Tone follows the palette: cyan = healthy/positive,
 * stamp-red = critical. No gradient, no glow.
 */

type Tone = "live" | "critical" | "steel";

const fillColor: Record<Tone, string> = {
  live: "bg-signal-cyan",
  critical: "bg-stamp-red",
  steel: "bg-steel-blue",
};

export function Meter({
  value,
  max,
  tone = "live",
  label,
  className = "",
}: {
  value: number;
  max: number;
  tone?: Tone;
  /** Accessible name for the meter, e.g. "Health 24/40". role="meter" requires one. */
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={`h-1.5 w-full bg-void-navy ${className}`}
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`h-full ${fillColor[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
