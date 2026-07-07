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
  type NewCard,
  type NewCardEffect,
} from "@/lib/schema";
import {
  CARD_CATEGORIES,
  CARD_TEXT_LIMITS,
  ITEM_SUBCATEGORIES,
  WEAPON_DAMAGE_TYPES,
  isHexColor,
  isWeaponSubcategory,
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
import { validateWeaponFields } from "@/lib/weapons";
import { parseSignedInt, type Result } from "@/lib/ledger";

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
    }

    const weaponCheck = validateWeaponFields({
      subcategory,
      handedness,
      damageType,
      damage,
      range,
      ammoCount,
    });
    if (!weaponCheck.ok) return { error: weaponCheck.error };
  }

  // Weapons carry their own mechanical stat line (damage/range/ammo/handedness)
  // on the card face, so unlike other cards they don't need an effect or
  // descriptive blurb to not read as blank.
  if (
    effects.length === 0 &&
    !descriptiveText &&
    !isWeaponSubcategory(subcategory)
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
    descriptiveText,
    subcategory,
    handedness,
    damageType,
    damage,
    range,
    ammoCount,
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
    }

    const weaponCheck = validateWeaponFields({
      subcategory,
      handedness,
      damageType,
      damage,
      range,
      ammoCount,
    });
    if (!weaponCheck.ok) return { error: weaponCheck.error };
  }

  if (
    effects.length === 0 &&
    !descriptiveText &&
    !isWeaponSubcategory(subcategory)
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
    descriptiveText,
    subcategory,
    handedness,
    damageType,
    damage,
    range,
    ammoCount,
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
