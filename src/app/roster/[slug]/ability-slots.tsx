import { HexBadge, iconForCategory } from "@/components/cards/game-card";
import { Panel } from "@/components/ui/panel";
import type { OwnedCard } from "@/lib/card-data";
import { CARD_CATEGORY_META } from "@/lib/cards";
import {
  BASE_ABILITY_SLOTS,
  SLOT_LIMITED_CATEGORIES,
  categorySlotUsage,
  sharedPoolRemaining,
  tallyEquippedByCategory,
  type SlotCountMap,
} from "@/lib/card-slots";

/*
 * Case File "Ability Slots" panel (own card, left column, below Attributes —
 * split out of the Loadout panel so it doesn't compete with the already
 * dense Loadout/Effects sections for attention). One shared pool of
 * BASE_ABILITY_SLOTS plus a per-category reserved bonus (facility purchases/
 * admin overrides, see lib/card-slots.ts). Each category tile reuses the
 * same hex badge as the physical card design (HexBadge/iconForCategory) so
 * the breakdown reads as "the cards' own symbols", not a generic icon set.
 * Only shown for categories the character actually owns a card in, or has a
 * bonus for — avoids listing all 7 categories on an operator who's never
 * touched half of them.
 *
 * A category's `cap` (BASE_ABILITY_SLOTS + its bonus) is only a real,
 * category-exclusive ceiling once that category actually has a bonus — the
 * BASE portion is a *shared* pool other categories can also draw from, so a
 * bonus-less category showing e.g. "1/3" would wrongly read as "2 more slots
 * reserved for me" when those 3 are shared with everyone. Bonus-less
 * categories therefore show a plain equipped count instead of a fraction;
 * only a real per-category reservation gets a "used/cap" readout + pips.
 */
export function AbilitySlots({
  owned,
  bonusByCategory,
}: {
  owned: OwnedCard[];
  bonusByCategory: SlotCountMap;
}) {
  const equippedByCategory = tallyEquippedByCategory(owned);
  // Cards flagged "Free (no slot cost)" never spend a slot (lib/card-slots.ts
  // takesSlot), so a category holding only those shouldn't surface here —
  // it'd show a "0 equipped" tile that spends slots it never actually does.
  const ownedCategories = new Set(
    owned.filter((o) => o.card.takesSlot).map((o) => o.card.category),
  );
  const visible = SLOT_LIMITED_CATEGORIES.filter(
    (c) => ownedCategories.has(c) || bonusByCategory[c] > 0,
  );
  if (visible.length === 0) return null;

  const usage = categorySlotUsage(equippedByCategory, bonusByCategory).filter((u) =>
    visible.includes(u.category),
  );
  const remaining = sharedPoolRemaining(equippedByCategory, bonusByCategory);
  const totalBonus = SLOT_LIMITED_CATEGORIES.reduce((sum, c) => sum + bonusByCategory[c], 0);
  const totalCap = BASE_ABILITY_SLOTS + totalBonus;

  return (
    <Panel
      title="Ability Slots"
      meta={
        <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
          Base {remaining}/{totalCap}
        </span>
      }
    >
      <ul className="flex flex-col gap-2">
        {usage.map((u) => {
          const meta = CARD_CATEGORY_META[u.category];
          return (
            <li key={u.category} className="flex items-center gap-3 bg-void-navy p-3">
              <HexBadge icon={iconForCategory(meta.icon)} size={32} background={meta.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-case-file-white">
                  {meta.label}
                </p>
                <p className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                  {u.bonus > 0 ? (
                    <>
                      {u.used}
                      <span className="text-case-file-white">/{u.cap}</span>
                      <span className="text-signal-cyan"> (+{u.bonus})</span>
                    </>
                  ) : (
                    `${u.used} equipped`
                  )}
                </p>
              </div>
              {u.bonus > 0 && <SlotPips used={u.used} cap={u.cap} color={meta.color} />}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// A row of hex pips mirroring the card's own hex badge shape — filled (in
// the category's accent) for each occupied slot, outlined for each free one.
// Only shown for categories with a real bonus reservation (see module doc);
// otherwise there's no meaningful per-category ceiling to draw pips against.
// Rendered as SVG rather than a CSS clip-path + border — a border clipped by
// an angled polygon only survives on the axis-aligned parts of the box,
// leaving gaps on the hex's slanted edges, while an SVG stroke traces the
// exact path with no such artifact.
function SlotPips({ used, cap, color }: { used: number; cap: number; color: string }) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1" aria-hidden="true">
      {Array.from({ length: cap }, (_, i) => (
        <svg key={i} width={10} height={10} viewBox="0 0 10 10" className="shrink-0">
          <polygon
            points="5,0 10,2.5 10,7.5 5,10 0,7.5 0,2.5"
            fill={i < used ? color : "none"}
            stroke={color}
            strokeWidth={i < used ? 0 : 1}
            opacity={i < used ? 1 : 0.6}
          />
        </svg>
      ))}
    </div>
  );
}
