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
  Focus,
  Anvil,
  type LucideIcon,
} from "lucide-react";
import type { Card, CardWithEffects } from "@/lib/schema";
import { Markdown } from "@/components/ui/markdown";
import {
  CARD_CATEGORY_META,
  ITEM_SUBCATEGORY_META,
  WEAPON_DAMAGE_TYPE_LABELS,
  cardAccent,
  effectSummary,
  isWeaponSubcategory,
  isModCategory,
  modDeltaSummary,
  toRoman,
  TRIGGER_LABELS,
} from "@/lib/cards";
import type { ItemSubcategory } from "@/lib/cards";
import { computeWeaponProfile, type InstalledModFields } from "@/lib/weapons";

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
  firearm_mod: Focus,
  melee_mod: Anvil,
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

// The mod info a weapon card needs to render its Installed Mods box — the
// delta fields (WeaponStatGrid's effective-stat math) plus a title (the box
// names each mod, unlike the stat grid which only needs the numbers).
type ModCardFields = Pick<
  Card,
  "title" | "modDamageDelta" | "modRangeDelta" | "modAddedDamageType"
>;

// Tints `hex` toward transparent — used to derive the Installed Mods box's
// background from the card's own accent so it reads as "this weapon's mods"
// rather than a generic panel, without needing a second color per category.
function tint(hex: string, alpha: number): string {
  return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
}

export function GameCard({
  card,
  menu,
  mods = [],
}: {
  card: CardWithEffects;
  /** Optional corner control (e.g. the admin library's action menu). Rendered
   *  in-flow next to the title, not overlaid, so it can never cover it. */
  menu?: React.ReactNode;
  /** Mods installed on this weapon (weapon customisation). When given, the
   *  stat grid shows effective damage/range/type and an Installed Mods box
   *  appears at the bottom of the body listing each one. Ignored for
   *  non-weapon cards. */
  mods?: ModCardFields[];
}) {
  const meta = CARD_CATEGORY_META[card.category];
  const accent = cardAccent(card.category, card.colorOverride, card.subcategory);
  const isItemWithSubcategory = card.category === "item" && card.subcategory;
  const isMod = isModCategory(card.category);
  const Icon = isItemWithSubcategory
    ? SUBCATEGORY_ICONS[card.subcategory!]
    : ICONS[meta.icon] ?? Sparkles;
  const isWeapon = isWeaponSubcategory(card.subcategory);

  return (
    <article
      className="relative flex aspect-[7/10] w-full flex-col gap-2 overflow-hidden p-2.5 pb-7 font-[family-name:var(--font-chakra)] text-case-file-white"
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
        {isMod && (
          <span className="bg-void-navy px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-signal-cyan">
            {meta.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        className="relative flex-1 overflow-hidden bg-void-navy p-3"
        style={{ clipPath: BODY_CLIP }}
      >
        <div className="flex h-full flex-col gap-2 overflow-y-auto">
          {isWeapon && <WeaponStatGrid card={card} mods={mods} />}

          {isMod &&
            modDeltaSummary(card).map((line) => (
              <p
                key={line}
                className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-signal-cyan"
              >
                {line}
              </p>
            ))}

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

          {isWeapon && mods.length > 0 && (
            <InstalledModsBox
              mods={mods}
              modSlots={card.modSlots}
              accent={accent}
              className="mt-auto"
            />
          )}
        </div>
      </div>

      {/* Level pip */}
      <span className="absolute bottom-0.5 left-2.5 font-[family-name:var(--font-rajdhani)] text-2xl font-bold leading-none text-case-file-white">
        {toRoman(card.level)}
      </span>
    </article>
  );
}

// Installed mods (weapon customisation), boxed in a single scrollable row at
// the bottom of the card — a fixed one-line footprint regardless of how many
// mods are installed, so a heavily-modded weapon's card never grows taller
// than an unmodded one and distorts the surrounding grid. Tinted with the
// card's own accent (via `tint`) rather than a fixed color so it reads as
// "this weapon's mods" without adding a third color per category.
function InstalledModsBox({
  mods,
  modSlots,
  accent,
  className = "",
}: {
  mods: ModCardFields[];
  modSlots: number | null;
  accent: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
        Mods{modSlots ? ` ${mods.length}/${modSlots}` : ""}
      </span>
      <div
        className="grid auto-cols-fr grid-flow-col gap-px overflow-x-auto"
        style={{ backgroundColor: tint(accent, 0.4) }}
      >
        {mods.map((mod, i) => {
          const deltas = modDeltaSummary(mod);
          return (
            <div
              key={`${mod.title}-${i}`}
              className="flex min-w-[4.5rem] flex-col items-center justify-center gap-0.5 px-1.5 py-2 text-center"
              style={{ backgroundColor: tint(accent, 0.14) }}
            >
              <span className="line-clamp-2 text-[0.5625rem] font-semibold uppercase leading-tight tracking-[0.04em] text-case-file-white">
                {mod.title}
              </span>
              {deltas.map((line) => (
                <span
                  key={line}
                  className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] font-semibold leading-none text-signal-cyan"
                >
                  {line}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
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
  /** e.g. "(+2)" — a mod-driven delta shown next to the effective value. */
  delta?: string;
}

// e.g. 2 -> "(+2)", -15 -> "(−15)".
function formatDelta(n: number): string {
  return n >= 0 ? `(+${n})` : `(−${Math.abs(n)})`;
}

function WeaponStatGrid({
  card,
  mods = [],
}: {
  card: CardWithEffects;
  mods?: InstalledModFields[];
}) {
  const profile = computeWeaponProfile(
    { damage: card.damage, range: card.range, damageType: card.damageType },
    mods,
  );
  const damageTypeLabel = profile.damageTypes
    .map((t) => WEAPON_DAMAGE_TYPE_LABELS[t])
    .join(" + ");

  const cells: (WeaponStatCell | null)[] = [
    {
      key: "dmg",
      value: profile.damage,
      label: "Dmg",
      tone: "red",
      delta: profile.damageDelta !== 0 ? formatDelta(profile.damageDelta) : undefined,
    },
    damageTypeLabel ? { key: "type", value: damageTypeLabel, label: "Type" } : null,
    profile.range != null
      ? {
          key: "range",
          icon: Radar,
          value: `${profile.range}M`,
          label: "Range",
          delta: profile.rangeDelta !== 0 ? formatDelta(profile.rangeDelta) : undefined,
        }
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
          delta={cell.delta}
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
  delta,
  className = "",
}: {
  icon?: LucideIcon;
  value: string | number;
  label?: string;
  tone?: "cyan" | "red";
  /** e.g. "(+2)" — a mod-driven delta shown next to the effective value. */
  delta?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 bg-void-navy px-1 py-2 text-center ${className}`}
    >
      {Icon && (
        <Icon
          size={12}
          strokeWidth={2}
          className={tone === "red" ? "text-stamp-red" : "text-signal-cyan"}
          aria-hidden="true"
        />
      )}
      <span className="flex flex-col items-center gap-0.5">
        <span
          className={`text-balance break-words font-[family-name:var(--font-jetbrains)] text-sm font-bold leading-tight ${
            tone === "red" ? "text-stamp-red" : "text-case-file-white"
          }`}
        >
          {value}
        </span>
        {delta && (
          <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] font-semibold leading-none text-signal-cyan">
            {delta}
          </span>
        )}
      </span>
      {label && (
        <span className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
          {label}
        </span>
      )}
    </div>
  );
}
