import { eq, asc, desc } from "drizzle-orm";
import { getDb } from "./db";
import { cards, characterCards, characters, type Card } from "./schema";
import type { CharacterView } from "./characters";
import type { StatKey } from "./status";
import {
  accumulateModifiers,
  applyModifiers,
  effectSummary,
  isPersistentEffect,
  type CardEffectFields,
} from "./cards";
import { clampResource } from "./ledger";

/*
 * Card read model (Phase 3). DB access + the character loadout projection. The
 * effective-stat math itself is the pure, tested code in lib/cards.ts; this file
 * only fetches rows and maps between the `characters` column keys the effects
 * target (statTech, hpMax…) and the nested view shape the Case File renders.
 */

export interface OwnedCard {
  assignmentId: string; // character_cards.id
  equipped: boolean;
  card: Card;
}

/** Every card definition, newest first — for the admin library + assign picker. */
export async function getCardLibrary(): Promise<Card[]> {
  const db = getDb();
  return db.query.cards.findMany({ orderBy: [desc(cards.createdAt)] });
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
    with: { card: true },
    orderBy: [desc(characterCards.equipped), asc(characterCards.acquiredAt)],
  });
  return rows.map((r) => ({
    assignmentId: r.id,
    equipped: r.equipped,
    card: r.card,
  }));
}

/**
 * Effective resource maxes (base + equipped resource-modifier cards) for one
 * character. Used by the resource-tracking action so a player can fill up to a
 * card-boosted max, not just the base. Kept small + self-contained so the write
 * path doesn't need to build a full CharacterView.
 */
export async function effectiveResourceMaxes(
  characterId: string,
  base: { hpMax: number; energyMax: number; ammoMax: number },
): Promise<{ hpMax: number; energyMax: number; ammoMax: number }> {
  const owned = await getCharacterCards(characterId);
  const mods = accumulateModifiers(
    owned.filter((o) => o.equipped).map((o) => toEffectFields(o.card)),
  );
  const { effective } = applyModifiers(
    { hpMax: base.hpMax, energyMax: base.energyMax, ammoMax: base.ammoMax },
    mods,
  );
  return {
    hpMax: effective.hpMax,
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

function toEffectFields(card: Card): CardEffectFields {
  return {
    effectKind: card.effectKind,
    effectType: card.effectType,
    effectTarget: card.effectTarget,
    effectAmount: card.effectAmount,
    trigger: card.trigger,
  };
}

export interface ActiveModifier {
  cardTitle: string;
  category: Card["category"];
  summary: string; // e.g. "+1 Tech"
}

export interface DescriptiveEffect {
  cardTitle: string;
  category: Card["category"];
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

  // Base map in characters-column keys, matching what effects target.
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

  const mods = accumulateModifiers(equipped.map((o) => toEffectFields(o.card)));
  const { effective, deltas } = applyModifiers(base, mods);

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

  const activeModifiers: ActiveModifier[] = equipped
    .filter((o) => isPersistentEffect(toEffectFields(o.card)))
    .map((o) => ({
      cardTitle: o.card.title,
      category: o.card.category,
      summary: effectSummary(toEffectFields(o.card)) ?? "",
    }));

  const descriptiveEffects: DescriptiveEffect[] = equipped
    .filter((o) => o.card.effectKind === "descriptive" && o.card.descriptiveText)
    .map((o) => ({
      cardTitle: o.card.title,
      category: o.card.category,
      text: o.card.descriptiveText!,
    }));

  return {
    owned,
    equipped,
    inventory,
    effectiveStats,
    statDeltas,
    resources,
    resourceDeltas,
    activeModifiers,
    descriptiveEffects,
  };
}
