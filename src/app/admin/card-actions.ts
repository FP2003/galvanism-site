"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  cards,
  cardEffects,
  characterCards,
  characters,
  characterSlotOverrides,
  players,
  creditLedger,
  type NewCard,
  type NewCardEffect,
} from "@/lib/schema";
import { findRefundablePurchase } from "@/lib/facility-data";
import {
  CARD_CATEGORIES,
  CARD_TEXT_LIMITS,
  ITEM_SUBCATEGORIES,
  WEAPON_DAMAGE_TYPES,
  isHexColor,
  isWeaponSubcategory,
  isModCategory,
  validateMechanicalEffect,
  type CardCategory,
  type CardActivation,
  type CardEffectType,
  type CardTrigger,
  type ItemSubcategory,
  type MechanicalInput,
  type WeaponHandedness,
  type WeaponDamageType,
} from "@/lib/cards";
import { validateWeaponFields, validateModFields } from "@/lib/weapons";
import { parseSignedInt, type Result } from "@/lib/ledger";
import { SLOT_LIMITED_CATEGORIES, isSlotLimitedCategory } from "@/lib/card-slots";

/*
 * Card CRUD + assignment (Phase 3, admin only). The structured effect builder is
 * validated here server-side via lib/cards (a tampered client can't inject an
 * off-target or zero-amount effect). Cards live in a shared library; assigning
 * one links it to a character via character_cards.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

// Parses an optional non-negative integer form field: "" -> null, otherwise
// the raw parsed number (validateWeaponFields checks integer-ness/range).
function optionalIntField(formData: FormData, key: string): number | null {
  const raw = textField(formData, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

const ACTIVATIONS: CardActivation[] = ["active", "passive"];
const EFFECT_TYPES: CardEffectType[] = ["stat_modifier", "resource_modifier"];
const TRIGGERS: CardTrigger[] = ["on_equip", "on_use", "passive"];

// Parses + validates the client-serialized effect rows (see card-form.tsx). The
// client can't be trusted, so every field is re-checked here regardless of what
// the JSON claims to contain.
function parseEffectsField(raw: FormDataEntryValue | null): Result<MechanicalInput[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? "[]"));
  } catch {
    return { ok: false, error: "Malformed effect data." };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "Malformed effect data." };
  if (parsed.length > CARD_TEXT_LIMITS.effectsMax) {
    return { ok: false, error: `A card may have at most ${CARD_TEXT_LIMITS.effectsMax} effects.` };
  }

  const effects: MechanicalInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") return { ok: false, error: "Malformed effect data." };
    const r = row as Record<string, unknown>;

    const activation = String(r.activation ?? "") as CardActivation;
    const effectType = String(r.effectType ?? "") as CardEffectType;
    const effectTarget = String(r.effectTarget ?? "");
    const triggerRaw = String(r.trigger ?? "") as CardTrigger;
    const trigger = TRIGGERS.includes(triggerRaw) ? triggerRaw : "passive";

    if (!ACTIVATIONS.includes(activation)) {
      return { ok: false, error: "Pick an activation for each effect." };
    }
    if (!EFFECT_TYPES.includes(effectType)) {
      return { ok: false, error: "Choose an effect type for each effect." };
    }
    const parsedAmount = parseSignedInt(r.effectAmount);
    if (!parsedAmount.ok) return parsedAmount;

    const check = validateMechanicalEffect({
      activation,
      effectType,
      effectTarget,
      effectAmount: parsedAmount.value,
      trigger,
    });
    if (!check.ok) return check;

    effects.push(check.value);
  }
  return { ok: true, value: effects };
}

// Authors a new card definition for the shared library.
export async function createCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const categoryRaw = textField(formData, "category") as CardCategory;
  if (!CARD_CATEGORIES.includes(categoryRaw)) {
    return { error: "Pick a card category." };
  }

  const title = textField(formData, "title", CARD_TEXT_LIMITS.title);
  if (!title) return { error: "A card title is required." };

  const description =
    textField(formData, "description", CARD_TEXT_LIMITS.description) || null;

  const levelRaw = Number(textField(formData, "level"));
  const level = Number.isFinite(levelRaw)
    ? Math.max(1, Math.min(CARD_TEXT_LIMITS.levelMax, Math.floor(levelRaw)))
    : 1;

  const colorRaw = textField(formData, "colorOverride");
  let colorOverride: string | null = null;
  if (colorRaw) {
    if (!isHexColor(colorRaw)) {
      return { error: "Custom color must be a hex value like #4a3b7a." };
    }
    colorOverride = colorRaw;
  }

  const priceCredits = optionalIntField(formData, "priceCredits");
  if (Number.isNaN(priceCredits) || (priceCredits != null && priceCredits < 0)) {
    return { error: "Price must be a non-negative whole number." };
  }

  // Only meaningful for slot-limited categories (see isSlotLimitedCategory) —
  // item/mod cards never consume a slot regardless, so the field always
  // reads as true for them even if a tampered client sends "no".
  const takesSlot = isSlotLimitedCategory(categoryRaw)
    ? textField(formData, "takesSlot") !== "no"
    : true;

  const descriptiveText =
    textField(formData, "descriptiveText", CARD_TEXT_LIMITS.descriptiveText) ||
    null;

  const parsedEffects = parseEffectsField(formData.get("effects"));
  if (!parsedEffects.ok) return { error: parsedEffects.error };
  const effects = parsedEffects.value;

  // Item subcategory + weapon fields (pre-Phase 4). Only ever read from
  // formData when category = "item" — a non-item card never gets these
  // columns set, even if a tampered client sends them.
  let subcategory: ItemSubcategory | null = null;
  let handedness: WeaponHandedness | null = null;
  let damageType: WeaponDamageType | null = null;
  let damage: number | null = null;
  let range: number | null = null;
  let ammoCount: number | null = null;
  let modSlots: number | null = null;

  if (categoryRaw === "item") {
    const subRaw = textField(formData, "subcategory") as ItemSubcategory;
    if (!ITEM_SUBCATEGORIES.includes(subRaw)) {
      return { error: "Pick an item subcategory." };
    }
    subcategory = subRaw;

    if (isWeaponSubcategory(subcategory)) {
      const handednessRaw = textField(formData, "handedness") as WeaponHandedness;
      handedness =
        handednessRaw === "one_handed" || handednessRaw === "two_handed"
          ? handednessRaw
          : null;
      const damageTypeRaw = textField(formData, "damageType") as WeaponDamageType;
      damageType = WEAPON_DAMAGE_TYPES.includes(damageTypeRaw) ? damageTypeRaw : null;
      damage = optionalIntField(formData, "damage");
      range = optionalIntField(formData, "range");
      ammoCount = optionalIntField(formData, "ammoCount");
      modSlots = optionalIntField(formData, "modSlots");
    }

    const weaponCheck = validateWeaponFields({
      subcategory,
      handedness,
      damageType,
      damage,
      range,
      ammoCount,
      modSlots,
    });
    if (!weaponCheck.ok) return { error: weaponCheck.error };
  }

  // Mod fields (weapon customisation) — only ever read from formData when
  // category is firearm_mod/melee_mod. optionalIntField's plain Number()
  // parse handles the signed deltas fine; validateModFields checks
  // integer-ness/non-zero/range.
  let modDamageDelta: number | null = null;
  let modRangeDelta: number | null = null;
  let modAddedDamageType: WeaponDamageType | null = null;

  if (isModCategory(categoryRaw)) {
    modDamageDelta = optionalIntField(formData, "modDamageDelta");
    modRangeDelta = optionalIntField(formData, "modRangeDelta");
    const addedTypeRaw = textField(formData, "modAddedDamageType") as WeaponDamageType;
    modAddedDamageType = WEAPON_DAMAGE_TYPES.includes(addedTypeRaw) ? addedTypeRaw : null;
  }

  const modCheck = validateModFields({
    category: categoryRaw,
    modDamageDelta,
    modRangeDelta,
    modAddedDamageType,
    descriptiveText,
  });
  if (!modCheck.ok) return { error: modCheck.error };

  // Weapons carry their own mechanical stat line (damage/range/ammo/handedness)
  // on the card face, and mods are validated by validateModFields above, so
  // neither needs an effect or descriptive blurb to not read as blank.
  if (
    effects.length === 0 &&
    !descriptiveText &&
    !isWeaponSubcategory(subcategory) &&
    !isModCategory(categoryRaw)
  ) {
    return { error: "Add at least one effect or some descriptive text." };
  }

  const values: NewCard = {
    category: categoryRaw,
    title,
    description,
    level,
    colorOverride,
    priceCredits,
    takesSlot,
    descriptiveText,
    subcategory,
    handedness,
    damageType,
    damage,
    range,
    ammoCount,
    modSlots,
    modDamageDelta,
    modRangeDelta,
    modAddedDamageType,
    createdByUserId: admin.id,
  };

  const db = getDb();
  let cardId: string;
  try {
    // neon-http has no transaction support, so the card and its effects are
    // inserted separately; if the effects insert fails, the card is deleted
    // to avoid leaving an orphaned card with no effects and no text.
    const [card] = await db.insert(cards).values(values).returning({ id: cards.id });
    cardId = card.id;
  } catch (err) {
    return {
      error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (effects.length > 0) {
    try {
      const rows: NewCardEffect[] = effects.map((e, i) => ({
        cardId,
        activation: e.activation,
        effectType: e.effectType,
        effectTarget: e.effectTarget,
        effectAmount: e.effectAmount,
        trigger: e.trigger,
        sortOrder: i,
      }));
      await db.insert(cardEffects).values(rows);
    } catch (err) {
      await db.delete(cards).where(eq(cards.id, cardId));
      return {
        error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  revalidatePath("/admin/cards");
  return { ok: true, message: `Card “${title}” created.` };
}

// Edits an existing card definition in place (title, effects, weapon fields,
// etc.) — same validation as createCard, but UPDATEs the row instead of
// inserting one.
export async function updateCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const cardId = textField(formData, "cardId");
  if (!cardId) return { error: "Missing card reference." };

  const categoryRaw = textField(formData, "category") as CardCategory;
  if (!CARD_CATEGORIES.includes(categoryRaw)) {
    return { error: "Pick a card category." };
  }

  const title = textField(formData, "title", CARD_TEXT_LIMITS.title);
  if (!title) return { error: "A card title is required." };

  const description =
    textField(formData, "description", CARD_TEXT_LIMITS.description) || null;

  const levelRaw = Number(textField(formData, "level"));
  const level = Number.isFinite(levelRaw)
    ? Math.max(1, Math.min(CARD_TEXT_LIMITS.levelMax, Math.floor(levelRaw)))
    : 1;

  const colorRaw = textField(formData, "colorOverride");
  let colorOverride: string | null = null;
  if (colorRaw) {
    if (!isHexColor(colorRaw)) {
      return { error: "Custom color must be a hex value like #4a3b7a." };
    }
    colorOverride = colorRaw;
  }

  const priceCredits = optionalIntField(formData, "priceCredits");
  if (Number.isNaN(priceCredits) || (priceCredits != null && priceCredits < 0)) {
    return { error: "Price must be a non-negative whole number." };
  }

  const takesSlot = isSlotLimitedCategory(categoryRaw)
    ? textField(formData, "takesSlot") !== "no"
    : true;

  const descriptiveText =
    textField(formData, "descriptiveText", CARD_TEXT_LIMITS.descriptiveText) ||
    null;

  const parsedEffects = parseEffectsField(formData.get("effects"));
  if (!parsedEffects.ok) return { error: parsedEffects.error };
  const effects = parsedEffects.value;

  let subcategory: ItemSubcategory | null = null;
  let handedness: WeaponHandedness | null = null;
  let damageType: WeaponDamageType | null = null;
  let damage: number | null = null;
  let range: number | null = null;
  let ammoCount: number | null = null;
  let modSlots: number | null = null;

  if (categoryRaw === "item") {
    const subRaw = textField(formData, "subcategory") as ItemSubcategory;
    if (!ITEM_SUBCATEGORIES.includes(subRaw)) {
      return { error: "Pick an item subcategory." };
    }
    subcategory = subRaw;

    if (isWeaponSubcategory(subcategory)) {
      const handednessRaw = textField(formData, "handedness") as WeaponHandedness;
      handedness =
        handednessRaw === "one_handed" || handednessRaw === "two_handed"
          ? handednessRaw
          : null;
      const damageTypeRaw = textField(formData, "damageType") as WeaponDamageType;
      damageType = WEAPON_DAMAGE_TYPES.includes(damageTypeRaw) ? damageTypeRaw : null;
      damage = optionalIntField(formData, "damage");
      range = optionalIntField(formData, "range");
      ammoCount = optionalIntField(formData, "ammoCount");
      modSlots = optionalIntField(formData, "modSlots");
    }

    const weaponCheck = validateWeaponFields({
      subcategory,
      handedness,
      damageType,
      damage,
      range,
      ammoCount,
      modSlots,
    });
    if (!weaponCheck.ok) return { error: weaponCheck.error };
  }

  let modDamageDelta: number | null = null;
  let modRangeDelta: number | null = null;
  let modAddedDamageType: WeaponDamageType | null = null;

  if (isModCategory(categoryRaw)) {
    modDamageDelta = optionalIntField(formData, "modDamageDelta");
    modRangeDelta = optionalIntField(formData, "modRangeDelta");
    const addedTypeRaw = textField(formData, "modAddedDamageType") as WeaponDamageType;
    modAddedDamageType = WEAPON_DAMAGE_TYPES.includes(addedTypeRaw) ? addedTypeRaw : null;
  }

  const modCheck = validateModFields({
    category: categoryRaw,
    modDamageDelta,
    modRangeDelta,
    modAddedDamageType,
    descriptiveText,
  });
  if (!modCheck.ok) return { error: modCheck.error };

  if (
    effects.length === 0 &&
    !descriptiveText &&
    !isWeaponSubcategory(subcategory) &&
    !isModCategory(categoryRaw)
  ) {
    return { error: "Add at least one effect or some descriptive text." };
  }

  const values: Partial<NewCard> = {
    category: categoryRaw,
    title,
    description,
    level,
    colorOverride,
    priceCredits,
    takesSlot,
    descriptiveText,
    subcategory,
    handedness,
    damageType,
    damage,
    range,
    ammoCount,
    modSlots,
    modDamageDelta,
    modRangeDelta,
    modAddedDamageType,
    updatedAt: new Date(),
  };

  const db = getDb();
  try {
    const [updated] = await db
      .update(cards)
      .set(values)
      .where(eq(cards.id, cardId))
      .returning({ id: cards.id });
    if (!updated) return { error: "Card not found." };
  } catch (err) {
    return {
      error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // neon-http has no transaction support (see createCard) — effects are
  // replaced wholesale (delete-then-insert) rather than diffed in place.
  try {
    await db.delete(cardEffects).where(eq(cardEffects.cardId, cardId));
    if (effects.length > 0) {
      const rows: NewCardEffect[] = effects.map((e, i) => ({
        cardId,
        activation: e.activation,
        effectType: e.effectType,
        effectTarget: e.effectTarget,
        effectAmount: e.effectAmount,
        trigger: e.trigger,
        sortOrder: i,
      }));
      await db.insert(cardEffects).values(rows);
    }
  } catch (err) {
    return {
      error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath("/admin/cards");
  revalidatePath("/roster");
  return { ok: true, message: `Card “${title}” updated.` };
}

// Removes a card from the library. Cascades to every assignment (unequips it
// from any operator who held it).
export async function deleteCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const cardId = textField(formData, "cardId");
  if (!cardId) return { error: "Missing card reference." };

  const db = getDb();
  await db.delete(cards).where(eq(cards.id, cardId));

  revalidatePath("/admin/cards");
  revalidatePath("/roster");
  return { ok: true, message: "Card deleted." };
}

// Loads a character's slug + player id for revalidation after an assignment change.
async function characterRefs(characterId: string) {
  const db = getDb();
  return db.query.characters.findFirst({
    where: eq(characters.id, characterId),
    columns: { slug: true, playerId: true },
  });
}

// Assigns a library card to a character's inventory (unequipped). A duplicate
// assignment is a silent no-op (unique on character+card).
export async function assignCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const characterId = textField(formData, "characterId");
  const cardId = textField(formData, "cardId");
  if (!characterId || !cardId) return { error: "Pick a card to assign." };

  const ref = await characterRefs(characterId);
  if (!ref) return { error: "Character not found." };

  const db = getDb();
  await db
    .insert(characterCards)
    .values({ characterId, cardId, equipped: false })
    .onConflictDoNothing();

  revalidatePath(`/admin/players/${ref.playerId}`);
  revalidatePath(`/roster/${ref.slug}`);
  return { ok: true, message: "Card assigned to inventory." };
}

// Removes a card from a character's inventory entirely.
export async function unassignCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const assignmentId = textField(formData, "assignmentId");
  if (!assignmentId) return { error: "Missing assignment reference." };

  const db = getDb();
  const [row] = await db
    .delete(characterCards)
    .where(eq(characterCards.id, assignmentId))
    .returning({ characterId: characterCards.characterId });
  if (!row) return { error: "Assignment not found." };

  const ref = await characterRefs(row.characterId);
  if (ref) {
    revalidatePath(`/admin/players/${ref.playerId}`);
    revalidatePath(`/roster/${ref.slug}`);
  }
  return { ok: true, message: "Card removed from inventory." };
}

// Undoes a facility purchase from the admin side: same shape as
// unassignCard, but also credits the player back the price of the original
// requisition (found via findRefundablePurchase) instead of just deleting
// the card for free. No self-refund time window here — a DM can undo a
// purchase at any point.
export async function refundCardPurchase(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const assignmentId = textField(formData, "assignmentId");
  if (!assignmentId) return { error: "Missing assignment reference." };

  const db = getDb();
  const owned = await db.query.characterCards.findFirst({
    where: eq(characterCards.id, assignmentId),
    with: { card: true },
  });
  if (!owned) return { error: "Assignment not found." };

  const ref = await characterRefs(owned.characterId);
  if (!ref) return { error: "Character not found." };
  const player = await db.query.players.findFirst({ where: eq(players.id, ref.playerId) });
  if (!player) return { error: "Player not found." };

  const entry = await findRefundablePurchase(player.id, owned.cardId);
  if (!entry) {
    return { error: "No purchase record found for this card — use Remove instead." };
  }
  const refundAmount = -entry.delta;

  const [deleted] = await db
    .delete(characterCards)
    .where(eq(characterCards.id, assignmentId))
    .returning({ id: characterCards.id });
  if (!deleted) return { error: "Assignment not found." };

  await db.batch([
    db
      .update(players)
      .set({ credits: player.credits + refundAmount, updatedAt: new Date() })
      .where(eq(players.id, player.id)),
    db.insert(creditLedger).values({
      playerId: player.id,
      description: `Refund (admin): ${owned.card.title}`,
      delta: refundAmount,
      balanceAfter: player.credits + refundAmount,
      refCode: owned.cardId,
      createdByUserId: admin.id,
    }),
  ]);

  revalidatePath(`/admin/players/${ref.playerId}`);
  revalidatePath(`/roster/${ref.slug}`);
  revalidatePath("/facilities");
  return { ok: true, message: `Refunded ${refundAmount} Cr and removed ${owned.card.title}.` };
}

// Admin-only detach: returns an installed mod to its owner's uninstalled
// inventory (weapon customisation is permanent for players — they can
// install but never remove; only the DM can undo it at the table).
export async function detachMod(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const assignmentId = textField(formData, "assignmentId");
  if (!assignmentId) return { error: "Missing assignment reference." };

  const db = getDb();
  const [row] = await db
    .update(characterCards)
    .set({ installedOnCharacterCardId: null })
    .where(eq(characterCards.id, assignmentId))
    .returning({ characterId: characterCards.characterId });
  if (!row) return { error: "Assignment not found." };

  const ref = await characterRefs(row.characterId);
  if (ref) {
    revalidatePath(`/admin/players/${ref.playerId}`);
    revalidatePath(`/roster/${ref.slug}`);
  }
  return { ok: true, message: "Mod detached and returned to inventory." };
}

// Admin's direct per-category bonus-slot override (Phase 8) — a straight
// overwrite, additive on top of (never replacing) any slots the character
// has separately bought via a facility slot-upgrade offering. One field per
// slot-limited category; each is upserted individually (this codebase's
// onConflictDoUpdate precedents — ballots/actions.ts, admin/mission-actions.ts
// — are both single-row upserts, so 7 individual ones in one batch is the
// safe, unambiguous choice over a bulk multi-row upsert with per-row values).
export async function setCharacterSlotOverrides(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const characterId = textField(formData, "characterId");
  if (!characterId) return { error: "Missing character reference." };

  const bonuses: Record<string, number> = {};
  for (const category of SLOT_LIMITED_CATEGORIES) {
    const raw = textField(formData, `bonus_${category}`);
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      return { error: "Bonus slots must be whole numbers of 0 or more." };
    }
    bonuses[category] = n;
  }

  const ref = await characterRefs(characterId);
  if (!ref) return { error: "Character not found." };

  const db = getDb();
  const statements = SLOT_LIMITED_CATEGORIES.map((category) =>
    db
      .insert(characterSlotOverrides)
      .values({ characterId, category, bonus: bonuses[category] })
      .onConflictDoUpdate({
        target: [characterSlotOverrides.characterId, characterSlotOverrides.category],
        set: { bonus: bonuses[category], updatedAt: new Date() },
      }),
  );
  // SLOT_LIMITED_CATEGORIES is statically non-empty; db.batch requires a
  // provably non-empty tuple type, which .map() can't produce on its own.
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);

  revalidatePath(`/admin/players/${ref.playerId}`);
  revalidatePath(`/roster/${ref.slug}`);
  return { ok: true, message: "Slot overrides updated." };
}
