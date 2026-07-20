import { eq, asc, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  cards,
  cardEffects,
  characterCards,
  characters,
  characterSlotPurchases,
  characterSlotOverrides,
  type CardWithEffects,
} from "./schema";
import type { CharacterView } from "./characters";
import type { StatKey } from "./status";
import {
  accumulateModifiers,
  applyModifiers,
  effectSummary,
  isPersistentEffect,
  isWeaponSubcategory,
  isModCategory,
} from "./cards";
import type { WeaponSlotName } from "./cards";
import { agilityMovementBonus, clampResource, movementMeters, resilienceHpBonus } from "./ledger";
import { emptySlotCountMap, mergeSlotCountMaps, isSlotLimitedCategory } from "./card-slots";
import type { SlotCountMap } from "./card-slots";

/*
 * Card read model (Phase 3). DB access + the character loadout projection. The
 * effective-stat math itself is the pure, tested code in lib/cards.ts; this file
 * only fetches rows and maps between the `characters` column keys the effects
 * target (statTech, hpMax…) and the nested view shape the Case File renders.
 */

export interface OwnedCard {
  assignmentId: string; // character_cards.id
  equipped: boolean;
  weaponSlot: WeaponSlotName | null;
  installedOnAssignmentId: string | null; // set iff a mod installed on a weapon assignment
  card: CardWithEffects;
}

/**
 * Splits owned cards three ways: weapon-subcategory (rifle/pistol/melee —
 * these use the primary/secondary/tertiary slot system), firearm_mod/melee_mod
 * (these install onto a weapon instead of using either toggle), and
 * everything else, which keeps using the plain equipped/inventory toggle.
 * Shared by the Case File Loadout and the admin per-character card
 * assignment panel.
 */
export function partitionByWeapon(owned: OwnedCard[]): {
  weapons: OwnedCard[];
  mods: OwnedCard[];
  rest: OwnedCard[];
} {
  const weapons: OwnedCard[] = [];
  const mods: OwnedCard[] = [];
  const rest: OwnedCard[] = [];
  for (const o of owned) {
    if (isWeaponSubcategory(o.card.subcategory)) {
      weapons.push(o);
    } else if (isModCategory(o.card.category)) {
      mods.push(o);
    } else {
      rest.push(o);
    }
  }
  return { weapons, mods, rest };
}

/**
 * Groups a character's owned mods by the weapon assignment they're installed
 * on. `uninstalled` holds mods not yet placed on any weapon. Callers pass the
 * `mods` bucket from {@link partitionByWeapon}.
 */
export function groupInstalledMods(mods: OwnedCard[]): {
  byHost: Map<string, OwnedCard[]>;
  uninstalled: OwnedCard[];
} {
  const byHost = new Map<string, OwnedCard[]>();
  const uninstalled: OwnedCard[] = [];
  for (const m of mods) {
    if (!m.installedOnAssignmentId) {
      uninstalled.push(m);
      continue;
    }
    const list = byHost.get(m.installedOnAssignmentId) ?? [];
    list.push(m);
    byHost.set(m.installedOnAssignmentId, list);
  }
  return { byHost, uninstalled };
}

/** Every card definition, newest first — for the admin library + assign picker. */
export async function getCardLibrary(): Promise<CardWithEffects[]> {
  const db = getDb();
  return db.query.cards.findMany({
    with: { effects: { orderBy: [asc(cardEffects.sortOrder)] } },
    orderBy: [desc(cards.createdAt)],
  });
}

export interface AssignmentTarget {
  id: string;
  callsign: string;
  approved: boolean;
}

/** An {@link AssignmentTarget} merged with per-card ownership: null when the
 *  operator doesn't hold the card (assignable), an assignment id when they
 *  already do (removable). */
export interface CardAssignmentTarget extends AssignmentTarget {
  assignmentId: string | null;
}

/** Every character, callsign-ordered — for the "assign to operator" picker on the card library. */
export async function getAssignmentTargets(): Promise<AssignmentTarget[]> {
  const db = getDb();
  return db.query.characters.findMany({
    columns: { id: true, callsign: true, approved: true },
    orderBy: [asc(characters.callsign)],
  });
}

/** cardId → characterId → assignment id, so the library's per-card operator
 *  list knows who already holds a card (and can remove it) vs. who doesn't
 *  (and can be assigned it). */
export async function getCardOwnershipMap(): Promise<
  Map<string, Map<string, string>>
> {
  const db = getDb();
  const rows = await db.query.characterCards.findMany({
    columns: { id: true, cardId: true, characterId: true },
  });
  const map = new Map<string, Map<string, string>>();
  for (const r of rows) {
    let byCharacter = map.get(r.cardId);
    if (!byCharacter) {
      byCharacter = new Map();
      map.set(r.cardId, byCharacter);
    }
    byCharacter.set(r.characterId, r.id);
  }
  return map;
}

/** The cards a character owns (inventory), equipped ones first. */
export async function getCharacterCards(
  characterId: string,
): Promise<OwnedCard[]> {
  const db = getDb();
  const rows = await db.query.characterCards.findMany({
    where: eq(characterCards.characterId, characterId),
    with: {
      card: { with: { effects: { orderBy: [asc(cardEffects.sortOrder)] } } },
    },
    orderBy: [desc(characterCards.equipped), asc(characterCards.acquiredAt)],
  });
  return rows.map((r) => ({
    assignmentId: r.id,
    equipped: r.equipped,
    weaponSlot: r.weaponSlot,
    installedOnAssignmentId: r.installedOnCharacterCardId,
    card: r.card,
  }));
}

/**
 * Persistent effects from mods installed on a currently-equipped host weapon.
 * Mods are never "equipped" themselves (they're tracked via
 * installedOnCharacterCardId, not the equipped toggle — see partitionByWeapon),
 * so their effects only reach the character while their host weapon is worn.
 */
function installedModEffects(
  equipped: OwnedCard[],
  owned: OwnedCard[],
): CardWithEffects["effects"] {
  const { byHost } = groupInstalledMods(
    owned.filter((o) => isModCategory(o.card.category)),
  );
  return equipped.flatMap(
    (host) => byHost.get(host.assignmentId)?.flatMap((m) => m.card.effects) ?? [],
  );
}

/**
 * Effective resource maxes (base + equipped resource-modifier cards, plus any
 * installed mods on those equipped cards) for one character. Used by the
 * resource-tracking action so a player can fill up to a card-boosted max, not
 * just the base. Kept small + self-contained so the write path doesn't need to
 * build a full CharacterView.
 */
export async function effectiveResourceMaxes(
  characterId: string,
  base: { hpMax: number; energyMax: number; ammoMax: number; statResilience: number },
): Promise<{ hpMax: number; energyMax: number; ammoMax: number }> {
  const owned = await getCharacterCards(characterId);
  const equipped = owned.filter((o) => o.equipped);
  const mods = accumulateModifiers([
    ...equipped.flatMap((o) => o.card.effects),
    ...installedModEffects(equipped, owned),
  ]);
  const { effective } = applyModifiers(
    {
      hpMax: base.hpMax,
      energyMax: base.energyMax,
      ammoMax: base.ammoMax,
      statResilience: base.statResilience,
    },
    mods,
  );
  return {
    // Resilience's +2 HP/point rule uses the effective (post-card) Resilience,
    // so a statResilience card bonus correctly raises HP too.
    hpMax: effective.hpMax + resilienceHpBonus(effective.statResilience),
    energyMax: effective.energyMax,
    ammoMax: effective.ammoMax,
  };
}

// characters column key ⇄ CharacterView stat key.
const STAT_COLUMN: Record<StatKey, string> = {
  tech: "statTech",
  precision: "statPrecision",
  strength: "statStrength",
  immunity: "statImmunity",
  resilience: "statResilience",
  agility: "statAgility",
};

export interface ActiveModifier {
  cardTitle: string;
  category: CardWithEffects["category"];
  colorOverride: CardWithEffects["colorOverride"];
  subcategory: CardWithEffects["subcategory"];
  summary: string; // e.g. "+1 Tech"
}

export interface DescriptiveEffect {
  cardTitle: string;
  category: CardWithEffects["category"];
  text: string;
}

export interface Loadout {
  owned: OwnedCard[];
  equipped: OwnedCard[];
  inventory: OwnedCard[]; // owned but not equipped
  effectiveStats: Record<StatKey, number>;
  statDeltas: Record<StatKey, number>; // net card contribution per stat (0 = none)
  resources: {
    hp: { current: number; max: number };
    energy: { current: number; max: number };
    ammo: { current: number; max: number };
  };
  resourceDeltas: { hpMax: number; energyMax: number; ammoMax: number };
  // Effective movement = movementBase + METERS_PER_EP * movementEpSpent. `max`
  // is the ceiling if every bit of currently-available (card-adjusted) Energy
  // were committed to movement — movementBase + METERS_PER_EP * (epSpent +
  // energy.current) — so it shrinks live as Energy is spent on other actions.
  movement: { current: number; max: number };
  activeModifiers: ActiveModifier[]; // the mechanical "ledger" of equipped buffs
  descriptiveEffects: DescriptiveEffect[]; // feat-like text from equipped cards
}

/**
 * Projects a character's base sheet + owned cards into the effective loadout the
 * Case File renders. Base values are never mutated: effective = base + the sum of
 * persistent (on_equip/passive) modifiers from *equipped* cards.
 */
export function computeLoadout(view: CharacterView, owned: OwnedCard[]): Loadout {
  const equipped = owned.filter((o) => o.equipped);
  const inventory = owned.filter((o) => !o.equipped);

  // Base map in characters-column keys, matching what effects target. The
  // Resilience -> HP and Agility -> Movement derived-stat rules are folded in
  // AFTER modifiers apply (below), from the effective stat, so a card's own
  // statResilience/statAgility bonus correctly raises HP/Movement too.
  const base: Record<string, number> = {
    statTech: view.stats.tech,
    statPrecision: view.stats.precision,
    statStrength: view.stats.strength,
    statImmunity: view.stats.immunity,
    statResilience: view.stats.resilience,
    statAgility: view.stats.agility,
    hpMax: view.hp.max,
    energyMax: view.energy.max,
    ammoMax: view.ammo.max,
  };

  const mods = accumulateModifiers([
    ...equipped.flatMap((o) => o.card.effects),
    ...installedModEffects(equipped, owned),
  ]);
  const { effective, deltas } = applyModifiers(base, mods);
  effective.hpMax += resilienceHpBonus(effective.statResilience);

  const effectiveStats = {} as Record<StatKey, number>;
  const statDeltas = {} as Record<StatKey, number>;
  (Object.keys(STAT_COLUMN) as StatKey[]).forEach((k) => {
    effectiveStats[k] = effective[STAT_COLUMN[k]];
    statDeltas[k] = deltas[STAT_COLUMN[k]] ?? 0;
  });

  const resourceDeltas = {
    hpMax: deltas.hpMax ?? 0,
    energyMax: deltas.energyMax ?? 0,
    ammoMax: deltas.ammoMax ?? 0,
  };

  // Current is clamped to the effective max so a removed +max card can't leave
  // the meter reading over 100%.
  const resources = {
    hp: {
      current: clampResource(view.hp.current, effective.hpMax),
      max: effective.hpMax,
    },
    energy: {
      current: clampResource(view.energy.current, effective.energyMax),
      max: effective.energyMax,
    },
    ammo: {
      current: clampResource(view.ammo.current, effective.ammoMax),
      max: effective.ammoMax,
    },
  };

  // Agility's +1 movement per 2 points rule uses the effective (post-card)
  // Agility, so a card's statAgility bonus correctly raises Movement too.
  const movementBase = view.movementBase + agilityMovementBonus(effective.statAgility);
  const movement = {
    current: movementMeters(movementBase, view.movementEpSpent),
    max: movementMeters(movementBase, view.movementEpSpent + resources.energy.current),
  };

  // Mods carry card_effects too (e.g. a scope's +1 Precision), but they're
  // never "equipped" themselves — only their descriptive text/effects surface
  // here, and only while the host weapon they're installed on is equipped
  // (mirrors lib/weapons.ts computeWeaponProfile, which folds mod deltas into
  // the host's own displayed stat line the same way).
  const { byHost } = groupInstalledMods(
    owned.filter((o) => isModCategory(o.card.category)),
  );

  const activeModifiers: ActiveModifier[] = [
    ...equipped.flatMap((o) =>
      o.card.effects.filter(isPersistentEffect).map((e) => ({
        cardTitle: o.card.title,
        category: o.card.category,
        colorOverride: o.card.colorOverride,
        subcategory: o.card.subcategory,
        summary: effectSummary(e),
      })),
    ),
    ...equipped.flatMap((host) =>
      (byHost.get(host.assignmentId) ?? []).flatMap((mod) =>
        mod.card.effects.filter(isPersistentEffect).map((e) => ({
          cardTitle: `${mod.card.title} (on ${host.card.title})`,
          category: mod.card.category,
          colorOverride: mod.card.colorOverride,
          subcategory: mod.card.subcategory,
          summary: effectSummary(e),
        })),
      ),
    ),
  ];

  const descriptiveEffects: DescriptiveEffect[] = equipped
    .filter((o) => o.card.descriptiveText)
    .map((o) => ({
      cardTitle: o.card.title,
      category: o.card.category,
      text: o.card.descriptiveText!,
    }));

  for (const host of equipped) {
    const installed = byHost.get(host.assignmentId);
    if (!installed) continue;
    for (const mod of installed) {
      if (!mod.card.descriptiveText) continue;
      descriptiveEffects.push({
        cardTitle: `${mod.card.title} (on ${host.card.title})`,
        category: mod.card.category,
        text: mod.card.descriptiveText,
      });
    }
  }

  return {
    owned,
    equipped,
    inventory,
    effectiveStats,
    statDeltas,
    resources,
    resourceDeltas,
    movement,
    activeModifiers,
    descriptiveEffects,
  };
}

export interface SlotBonusBreakdown {
  purchased: SlotCountMap;
  override: SlotCountMap;
  total: SlotCountMap;
}

/**
 * A character's ability-card slot bonuses (Phase 8): slots banked via
 * facility slot-upgrade purchases (characterSlotPurchases) plus any admin
 * manual override (characterSlotOverrides), summed separately so callers can
 * tell them apart — `.override` alone seeds the admin override form (it must
 * not include purchased slots, or an edit would double-count them), while
 * `.total` (the additive merge of both) feeds the equip-capacity check and
 * every slot-usage display.
 */
export async function getCharacterSlotBonuses(characterId: string): Promise<SlotBonusBreakdown> {
  const db = getDb();
  const [purchaseRows, overrideRows] = await Promise.all([
    db.query.characterSlotPurchases.findMany({
      where: eq(characterSlotPurchases.characterId, characterId),
      columns: { category: true, slotsGranted: true },
    }),
    db.query.characterSlotOverrides.findMany({
      where: eq(characterSlotOverrides.characterId, characterId),
      columns: { category: true, bonus: true },
    }),
  ]);

  const purchased = emptySlotCountMap();
  for (const r of purchaseRows) {
    if (isSlotLimitedCategory(r.category)) purchased[r.category] += r.slotsGranted;
  }
  const override = emptySlotCountMap();
  for (const r of overrideRows) {
    if (isSlotLimitedCategory(r.category)) override[r.category] += r.bonus;
  }

  return { purchased, override, total: mergeSlotCountMaps(purchased, override) };
}
