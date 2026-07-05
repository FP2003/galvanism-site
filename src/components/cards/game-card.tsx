import {
  Crosshair,
  Shield,
  Wrench,
  ChevronsUp,
  HeartPulse,
  Cpu,
  Sparkles,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { Card } from "@/lib/schema";
import {
  CARD_CATEGORY_META,
  cardAccent,
  effectSummary,
  toRoman,
  TRIGGER_LABELS,
} from "@/lib/cards";

/*
 * GameCard — web recreation of the physical card designs (info/card_design/).
 * Category-colored frame, hex icon badge, title, DESCRIPTION + ACTIVE/PASSIVE
 * tag row, body copy, and a Roman-numeral level pip. The accent hex is inline
 * (category preset or the card's custom override) so custom cards Just Work.
 */

const ICONS: Record<string, LucideIcon> = {
  combat: Crosshair,
  defense: Shield,
  mod: Wrench,
  movement: ChevronsUp,
  resilience: HeartPulse,
  tech: Cpu,
  ability: Sparkles,
  item: Package,
};

// Beveled top-left + bottom-right corners, echoing the reference card silhouette.
const CARD_CLIP =
  "polygon(7% 0, 100% 0, 100% 93%, 93% 100%, 0 100%, 0 7%)";
const BODY_CLIP = "polygon(6% 0, 100% 0, 100% 100%, 0 100%, 0 6%)";

export function GameCard({
  card,
  menu,
}: {
  card: Card;
  /** Optional corner control (e.g. the admin library's action menu). Rendered
   *  in-flow next to the title, not overlaid, so it can never cover it. */
  menu?: React.ReactNode;
}) {
  const meta = CARD_CATEGORY_META[card.category];
  const accent = cardAccent(card.category, card.colorOverride);
  const Icon = ICONS[meta.icon] ?? Sparkles;
  const isActive = card.activation === "active";
  const summary = effectSummary(card);

  return (
    <article
      className="relative flex aspect-[7/10] w-full flex-col gap-2 p-2.5 pb-7 font-[family-name:var(--font-chakra)] text-case-file-white"
      style={{ backgroundColor: accent, clipPath: CARD_CLIP }}
    >
      {/* Header: hex icon badge + title. items-start keeps the icon, title,
       *  and menu flush against the same top edge so a wrapping title (up to
       *  48 chars) grows downward in place instead of recentering the row
       *  and dragging the menu down with it. */}
      <div className="flex items-start gap-2.5">
        <span
          className="grid size-11 shrink-0 place-items-center bg-void-navy text-case-file-white"
          style={{
            clipPath:
              "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
          }}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <h3 className="min-w-0 flex-1 text-pretty pt-1 text-sm font-bold uppercase leading-tight tracking-[0.04em] break-words">
          {card.title}
        </h3>
        {menu}
      </div>

      {/* DESCRIPTION label + ACTIVE/PASSIVE classification tag.
       *  Activation is card identity (how the ability triggers), not state — so
       *  it wears a neutral void-navy chip, never the reserved cyan/red state
       *  colors. White value against the muted-ink label reads as a matched
       *  label→value pair and stays legible on every category frame. */}
      <div className="flex items-center justify-between gap-2">
        <span className="bg-void-navy px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          Description
        </span>
        <span className="bg-void-navy px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-case-file-white">
          {isActive ? "Active" : "Passive"}
        </span>
      </div>

      {/* Body */}
      <div
        className="relative flex-1 overflow-hidden bg-void-navy p-3"
        style={{ clipPath: BODY_CLIP }}
      >
        <div className="flex h-full flex-col gap-2 overflow-y-auto">
          {card.description && (
            <p className="text-pretty font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-ink">
              {card.description}
            </p>
          )}

          {card.effectKind === "mechanical" && summary && (
            <p className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-signal-cyan">
              {summary}
              {card.trigger && (
                <span className="ml-1.5 text-[0.625rem] uppercase tracking-[0.08em] text-muted-ink">
                  · {TRIGGER_LABELS[card.trigger]}
                </span>
              )}
            </p>
          )}

          {card.effectKind === "descriptive" && card.descriptiveText && (
            <p className="text-pretty font-[family-name:var(--font-inter)] text-xs leading-relaxed text-case-file-white">
              {card.descriptiveText}
            </p>
          )}
        </div>
      </div>

      {/* Level pip */}
      <span className="absolute bottom-1.5 left-2.5 font-[family-name:var(--font-rajdhani)] text-lg font-bold leading-none text-case-file-white">
        {toRoman(card.level)}
      </span>
    </article>
  );
}
