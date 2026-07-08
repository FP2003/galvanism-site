import { MapPin } from "lucide-react";
import { StatusLabel } from "@/components/ui/status-dot";
import type { Mission } from "@/lib/schema";

/*
 * Shared mission display pieces — used by both the admin and player mission
 * list/detail pages so the two surfaces show identical information. Tags are
 * styled like the ACTIVE/PASSIVE badges in components/cards/game-card.tsx
 * (bg-void-navy, muted-ink text, no color escalation) rather than reusing the
 * StatusLabel tones, since risk/location aren't live/critical states —
 * DESIGN.md reserves stamp-red for genuinely critical status only.
 */

export const RISK_LABEL: Record<Mission["risk"], string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

export const STATUS_TONE: Record<Mission["status"], "neutral" | "live" | "critical"> = {
  available: "neutral",
  active: "live",
  complete: "live",
  failed: "critical",
};

export const STATUS_WORD: Record<Mission["status"], string> = {
  available: "Available",
  active: "Active",
  complete: "Complete",
  failed: "Failed",
};

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 bg-void-navy px-2 py-0.5 font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
      {children}
    </span>
  );
}

export function LocationTag({ sector }: { sector: string | null }) {
  return (
    <Tag>
      <MapPin size={10} aria-hidden="true" /> {sector ?? "No sector"}
    </Tag>
  );
}

export function RiskTag({ risk }: { risk: Mission["risk"] }) {
  return <Tag>Risk: {RISK_LABEL[risk]}</Tag>;
}

export function MissionStatusBadge({ status }: { status: Mission["status"] }) {
  return <StatusLabel tone={STATUS_TONE[status]}>{STATUS_WORD[status]}</StatusLabel>;
}
