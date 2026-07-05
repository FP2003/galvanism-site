"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { cards, characterCards, characters, type NewCard } from "@/lib/schema";
import {
  CARD_CATEGORIES,
  CARD_TEXT_LIMITS,
  isHexColor,
  validateMechanicalEffect,
  type CardCategory,
  type CardActivation,
  type CardEffectKind,
  type CardEffectType,
  type CardTrigger,
} from "@/lib/cards";
import { parseSignedInt } from "@/lib/ledger";

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

const ACTIVATIONS: CardActivation[] = ["active", "passive"];
const EFFECT_KINDS: CardEffectKind[] = ["mechanical", "descriptive"];
const EFFECT_TYPES: CardEffectType[] = ["stat_modifier", "resource_modifier"];
const TRIGGERS: CardTrigger[] = ["on_equip", "on_use", "passive"];

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

  const activationRaw = textField(formData, "activation") as CardActivation;
  const activation = ACTIVATIONS.includes(activationRaw)
    ? activationRaw
    : "passive";

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

  const effectKindRaw = textField(formData, "effectKind") as CardEffectKind;
  if (!EFFECT_KINDS.includes(effectKindRaw)) {
    return { error: "Choose a mechanical or descriptive effect." };
  }

  const values: NewCard = {
    category: categoryRaw,
    title,
    description,
    activation,
    level,
    colorOverride,
    effectKind: effectKindRaw,
    createdByUserId: admin.id,
  };

  if (effectKindRaw === "mechanical") {
    const effectType = textField(formData, "effectType") as CardEffectType;
    if (!EFFECT_TYPES.includes(effectType)) {
      return { error: "Choose an effect type." };
    }
    const effectTarget = textField(formData, "effectTarget");
    const triggerRaw = textField(formData, "trigger") as CardTrigger;
    const trigger = TRIGGERS.includes(triggerRaw) ? triggerRaw : "passive";

    const parsedAmount = parseSignedInt(formData.get("effectAmount"));
    if (!parsedAmount.ok) return { error: parsedAmount.error };

    const check = validateMechanicalEffect({
      effectType,
      effectTarget,
      effectAmount: parsedAmount.value,
      trigger,
    });
    if (!check.ok) return { error: check.error };

    values.effectType = effectType;
    values.effectTarget = effectTarget;
    values.effectAmount = parsedAmount.value;
    values.trigger = trigger;
  } else {
    const descriptiveText = textField(
      formData,
      "descriptiveText",
      CARD_TEXT_LIMITS.descriptiveText,
    );
    if (!descriptiveText) {
      return { error: "Descriptive cards need effect text." };
    }
    values.descriptiveText = descriptiveText;
  }

  const db = getDb();
  try {
    await db.insert(cards).values(values);
  } catch (err) {
    return {
      error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath("/admin/cards");
  return { ok: true, message: `Card “${title}” created.` };
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
