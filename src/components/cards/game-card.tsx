import {
  Crosshair,
  Shield,
  Wrench,
  ChevronsUp,
  HeartPulse,
  Cpu,
  Sparkles,
  Package,
  Syringe,
  Bomb,
  Swords,
  Target,
  Radar,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { CardWithEffects } from "@/lib/schema";
import { Markdown } from "@/components/ui/markdown";
import {
  CARD_CATEGORY_META,
  ITEM_SUBCATEGORY_META,
  WEAPON_DAMAGE_TYPE_LABELS,
  cardAccent,
  effectSummary,
  isWeaponSubcategory,
  toRoman,
  TRIGGER_LABELS,
} from "@/lib/cards";
import type { ItemSubcategory } from "@/lib/cards";

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

// Item cards additionally key off subcategory for a more specific icon.
const SUBCATEGORY_ICONS: Record<ItemSubcategory, LucideIcon> = {
  medical: Syringe,
  grenade: Bomb,
  rifle: Crosshair,
  pistol: Target,
  melee: Swords,
  other: Package,
};

// Beveled top-left + bottom-right corners, echoing the reference card silhouette.
const CARD_CLIP =
  "polygon(7% 0, 100% 0, 100% 93%, 93% 100%, 0 100%, 0 7%)";
const BODY_CLIP = "polygon(6% 0, 100% 0, 100% 100%, 0 100%, 0 6%)";

export function GameCard({
  card,
  menu,
}: {
  card: CardWithEffects;
  /** Optional corner control (e.g. the admin library's action menu). Rendered
   *  in-flow next to the title, not overlaid, so it can never cover it. */
  menu?: React.ReactNode;
}) {
  const meta = CARD_CATEGORY_META[card.category];
  const accent = cardAccent(card.category, card.colorOverride, card.subcategory);
  const isItemWithSubcategory = card.category === "item" && card.subcategory;
  const Icon = isItemWithSubcategory
    ? SUBCATEGORY_ICONS[card.subcategory!]
    : ICONS[meta.icon] ?? Sparkles;
  const isWeapon = isWeaponSubcategory(card.subcategory);

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

      {/* DESCRIPTION label. Each effect below carries its own ACTIVE/PASSIVE
       *  tag now — a card can mix both at once, so there's no single
       *  card-level classification to show here. */}
      <div className="flex items-center gap-2">
        <span className="bg-void-navy px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          Description
        </span>
        {isItemWithSubcategory && (
          <span className="bg-void-navy px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-signal-cyan">
            {ITEM_SUBCATEGORY_META[card.subcategory!].label}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        className="relative flex-1 overflow-hidden bg-void-navy p-3"
        style={{ clipPath: BODY_CLIP }}
      >
        <div className="flex h-full flex-col gap-2 overflow-y-auto">
          {isWeapon && <WeaponStatGrid card={card} />}

          {card.description && (
            <Markdown className="text-pretty font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-ink">
              {card.description}
            </Markdown>
          )}

          {card.effects.map((effect) => (
            <p
              key={effect.id}
              className="flex flex-wrap items-center gap-x-1.5 font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-signal-cyan"
            >
              {effectSummary(effect)}
              <span className="bg-void-navy px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.1em] text-case-file-white">
                {effect.activation === "active" ? "Active" : "Passive"}
              </span>
              <span className="text-[0.625rem] uppercase tracking-[0.08em] text-muted-ink">
                · {TRIGGER_LABELS[effect.trigger]}
              </span>
            </p>
          ))}

          {card.descriptiveText && (
            <Markdown className="text-pretty font-[family-name:var(--font-inter)] text-xs leading-relaxed text-case-file-white">
              {card.descriptiveText}
            </Markdown>
          )}
        </div>
      </div>

      {/* Level pip */}
      <span className="absolute bottom-1 left-2.5 font-[family-name:var(--font-rajdhani)] text-2xl font-bold leading-none text-case-file-white">
        {toRoman(card.level)}
      </span>
    </article>
  );
}

// The weapon stat panel (damage/type/range/rounds/grip). Rendered as a 2-col
// grid via the "gap-px + tinted gap background" trick, so dividing lines
// appear both between and below cells with no manual border bookkeeping —
// they just show through the gap. Cells are built as a list first so an odd
// count (e.g. a melee weapon with no range/ammo) can span its lone trailing
// cell across the full width instead of leaving a bare gap-colored square.
interface WeaponStatCell {
  key: string;
  icon?: LucideIcon;
  value: string | number;
  label?: string;
  tone?: "cyan" | "red";
}

function WeaponStatGrid({ card }: { card: CardWithEffects }) {
  const cells: (WeaponStatCell | null)[] = [
    { key: "dmg", value: card.damage ?? "—", label: "Dmg", tone: "red" },
    card.damageType
      ? { key: "type", value: WEAPON_DAMAGE_TYPE_LABELS[card.damageType], label: "Type" }
      : null,
    card.range != null
      ? { key: "range", icon: Radar, value: `${card.range}M`, label: "Range" }
      : null,
    card.ammoCount != null
      ? { key: "rnds", icon: Layers, value: card.ammoCount, label: "Rnds" }
      : null,
    { key: "grip", value: card.handedness === "two_handed" ? "2H" : "1H" },
  ];
  const visibleCells = cells.filter((c): c is WeaponStatCell => c !== null);

  return (
    <div className="grid grid-cols-2 gap-px border border-signal-cyan/25 bg-signal-cyan/20">
      {visibleCells.map((cell, i) => (
        <WeaponStat
          key={cell.key}
          icon={cell.icon}
          value={cell.value}
          label={cell.label}
          tone={cell.tone}
          className={
            i === visibleCells.length - 1 && visibleCells.length % 2 === 1
              ? "col-span-2"
              : ""
          }
        />
      ))}
    </div>
  );
}

// One cell of the weapon stat grid — an optional icon over a bold value over
// an optional tiny label, all centered. Icon/label are omitted for the Grip
// cell (1H/2H reads fine on its own) and the Damage cell (a flame icon read
// as misleading — damage type carries that meaning instead).
function WeaponStat({
  icon: Icon,
  value,
  label,
  tone = "cyan",
  className = "",
}: {
  icon?: LucideIcon;
  value: string | number;
  label?: string;
  tone?: "cyan" | "red";
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 bg-void-navy px-1 py-2.5 text-center ${className}`}
    >
      {Icon && (
        <Icon
          size={14}
          strokeWidth={2}
          className={tone === "red" ? "text-stamp-red" : "text-signal-cyan"}
          aria-hidden="true"
        />
      )}
      <span
        className={`font-[family-name:var(--font-jetbrains)] text-base font-bold leading-none ${
          tone === "red" ? "text-stamp-red" : "text-case-file-white"
        }`}
      >
        {value}
      </span>
      {label && (
        <span className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
          {label}
        </span>
      )}
    </div>
  );
}
