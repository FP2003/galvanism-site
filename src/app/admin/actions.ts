"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users, players, characters, creditLedger, xpLedger } from "@/lib/schema";
import { slugifyCallsign } from "@/lib/characters";
import { CHARACTER_STATUSES, type CharacterStatus } from "@/lib/status";
import { TEXT_LIMITS } from "@/lib/game-rules";
import {
  applyCreditsDelta,
  applyXpGrant,
  clampResource,
  parseSignedInt,
} from "@/lib/ledger";

export type CreatePlayerState = {
  ok?: boolean;
  error?: string;
  createdEmail?: string;
};

// Admin-only: provisions a new player account end-to-end (info/roadmap.md Phase 1
// deliverable). Creates the Clerk identity, then the mirrored `users` row and the
// `players` profile. Clerk is the identity source; role is fixed to "player" here.
export async function createPlayerAccount(
  _prev: CreatePlayerState,
  formData: FormData,
): Promise<CreatePlayerState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const name = String(formData.get("name") ?? "").trim().slice(0, TEXT_LIMITS.name);
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    return { error: "A valid email is required." };
  }
  if (password.length < 8) {
    return { error: "Initial password must be at least 8 characters." };
  }

  const client = await clerkClient();

  // 1. Create the Clerk identity.
  let clerkUserId: string;
  try {
    const created = await client.users.createUser({
      emailAddress: [email],
      password,
      ...(name ? { firstName: name } : {}),
      publicMetadata: { role: "player" },
      skipPasswordChecks: false,
    });
    clerkUserId = created.id;
  } catch (err) {
    return { error: clerkErrorMessage(err) };
  }

  // 2. Mirror into Postgres. On failure, roll back the Clerk user to avoid orphans.
  try {
    const db = getDb();
    await db.insert(users).values({
      id: clerkUserId,
      email,
      displayName: name || null,
      role: "player",
    });
    await db.insert(players).values({
      userId: clerkUserId,
      name: name || null,
      credits: 0,
    });
  } catch (err) {
    await client.users.deleteUser(clerkUserId).catch(() => {});
    return {
      error:
        err instanceof Error
          ? `Database error: ${err.message}`
          : "Failed to persist player record.",
    };
  }

  revalidatePath("/admin");
  return { ok: true, createdEmail: email };
}

// ---------------------------------------------------------------------------
// Phase 2 — character CRUD, player info, and credit ledger (admin only).
// ---------------------------------------------------------------------------

export type FormState = { ok?: boolean; error?: string; message?: string };

// Non-negative integer from a form field, with a fallback when blank.
function intField(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

// The full set of editable character columns, shared by create + update. Current
// resource values are clamped to their max so the sheet can never show 30/20.
function parseCharacterFields(formData: FormData):
  | { ok: true; values: typeof characters.$inferInsert }
  | { ok: false; error: string } {
  const callsign = textField(formData, "callsign", TEXT_LIMITS.callsign);
  const name = textField(formData, "name", TEXT_LIMITS.name);
  if (!callsign) return { ok: false, error: "Callsign is required." };
  if (!name) return { ok: false, error: "Operator name is required." };

  const statusRaw = textField(formData, "status") as CharacterStatus;
  const status = CHARACTER_STATUSES.includes(statusRaw) ? statusRaw : "standby";

  const hpMax = intField(formData, "hpMax");
  const energyMax = intField(formData, "energyMax");
  const ammoMax = intField(formData, "ammoMax");

  const values: typeof characters.$inferInsert = {
    // playerId + slug are set by the caller (create) or left untouched (update).
    playerId: "",
    slug: "",
    callsign,
    name,
    rank: textField(formData, "rank", TEXT_LIMITS.rank) || null,
    role: textField(formData, "role", TEXT_LIMITS.role) || null,
    status,
    hpMax,
    hpCurrent: clampResource(intField(formData, "hpCurrent"), hpMax),
    energyMax,
    energyCurrent: clampResource(intField(formData, "energyCurrent"), energyMax),
    energyRegen: intField(formData, "energyRegen", 3),
    ammoMax,
    ammoCurrent: clampResource(intField(formData, "ammoCurrent"), ammoMax),
    statTech: intField(formData, "statTech"),
    statPrecision: intField(formData, "statPrecision"),
    statStrength: intField(formData, "statStrength"),
    statImmunity: intField(formData, "statImmunity"),
    statResilience: intField(formData, "statResilience"),
    statAgility: intField(formData, "statAgility"),
    bio: textField(formData, "bio", TEXT_LIMITS.bio) || null,
  };
  return { ok: true, values };
}

function revalidateCharacter(slug: string, playerId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${slug}`);
  revalidatePath("/"); // command dashboard reads the roster
}

// Provisions the character sheet for a player who doesn't have one yet (1:1).
export async function createCharacter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const playerId = textField(formData, "playerId");
  if (!playerId) return { error: "Missing player reference." };

  const parsed = parseCharacterFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const slug = slugifyCallsign(parsed.values.callsign);
  if (!slug) return { error: "Callsign must contain letters or numbers." };

  const db = getDb();
  try {
    // Admin-created sheets are approved on creation (no application review).
    await db
      .insert(characters)
      .values({ ...parsed.values, playerId, slug, approved: true });
  } catch (err) {
    return { error: dbErrorMessage(err, slug) };
  }

  revalidateCharacter(slug, playerId);
  return { ok: true, message: `Character ${parsed.values.callsign} created.` };
}

// Updates every field of an existing character sheet. Slug is re-derived from the
// callsign so the URL tracks a rename.
export async function updateCharacter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const characterId = textField(formData, "characterId");
  const playerId = textField(formData, "playerId");
  if (!characterId || !playerId) return { error: "Missing character reference." };

  const parsed = parseCharacterFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const slug = slugifyCallsign(parsed.values.callsign);
  if (!slug) return { error: "Callsign must contain letters or numbers." };

  // Drop the create-only placeholders; keep the editable columns.
  const { playerId: _p, slug: _s, ...editable } = parsed.values;
  void _p;
  void _s;

  const db = getDb();
  try {
    await db
      .update(characters)
      .set({ ...editable, slug, updatedAt: new Date() })
      .where(eq(characters.id, characterId));
  } catch (err) {
    return { error: dbErrorMessage(err, slug) };
  }

  revalidateCharacter(slug, playerId);
  return { ok: true, message: "Character sheet updated." };
}

// Edits player-account info (operator name). The credits balance is handled
// by adjustCredits so every change is ledgered.
export async function updatePlayer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const playerId = textField(formData, "playerId");
  if (!playerId) return { error: "Missing player reference." };

  const name = textField(formData, "name", TEXT_LIMITS.name);
  const db = getDb();
  try {
    await db
      .update(players)
      .set({ name: name || null, updatedAt: new Date() })
      .where(eq(players.id, playerId));
  } catch (err) {
    return {
      error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/players/${playerId}`);
  return { ok: true, message: "Player info updated." };
}

// Applies a credits delta and appends the ledger row in a single batch so the
// balance and its audit entry can't diverge. Adjustment rules live in lib/ledger.
export async function adjustCredits(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const playerId = textField(formData, "playerId");
  const description = textField(formData, "description", TEXT_LIMITS.ledgerDescription);
  const refCode = textField(formData, "refCode", TEXT_LIMITS.refCode);
  if (!playerId) return { error: "Missing player reference." };
  if (!description) return { error: "A description is required for the ledger." };

  const parsedDelta = parseSignedInt(formData.get("amount"));
  if (!parsedDelta.ok) return { error: parsedDelta.error };

  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player) return { error: "Player not found." };

  const result = applyCreditsDelta(player.credits, parsedDelta.value);
  if (!result.ok) return { error: result.error };

  await db.batch([
    db
      .update(players)
      .set({ credits: result.value, updatedAt: new Date() })
      .where(eq(players.id, playerId)),
    db.insert(creditLedger).values({
      playerId,
      description,
      delta: parsedDelta.value,
      balanceAfter: result.value,
      refCode: refCode || null,
      createdByUserId: admin.id,
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/"); // dashboard/roster show credits
  revalidatePath("/roster");
  return {
    ok: true,
    message: `${parsedDelta.value >= 0 ? "+" : ""}${parsedDelta.value} Cr — new balance ${result.value}.`,
  };
}

// Grants XP to a character: Total XP and Currency XP both rise by the same
// amount (a grant is newly-earned XP, so Total XP can't be reduced here — a
// correction is a fresh reversing entry, same convention as the credit ledger).
// Balance + ledger row are batched so they can't diverge. This is deliberately
// the only path that moves XP so a future missions feature can call it directly
// for a reward payout without touching character-sheet CRUD.
export async function grantXp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const characterId = textField(formData, "characterId");
  const description = textField(formData, "description", TEXT_LIMITS.ledgerDescription);
  const refCode = textField(formData, "refCode", TEXT_LIMITS.refCode);
  if (!characterId) return { error: "Missing character reference." };
  if (!description) return { error: "A description is required for the ledger." };

  const amountRaw = Number(String(formData.get("amount") ?? "").trim());
  if (!Number.isFinite(amountRaw)) return { error: "Enter a whole number." };

  const db = getDb();
  const character = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  });
  if (!character) return { error: "Character not found." };

  const result = applyXpGrant(character.totalXp, character.currencyXp, Math.floor(amountRaw));
  if (!result.ok) return { error: result.error };

  await db.batch([
    db
      .update(characters)
      .set({
        totalXp: result.value.totalXp,
        currencyXp: result.value.currencyXp,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId)),
    db.insert(xpLedger).values({
      characterId,
      description,
      delta: Math.floor(amountRaw),
      totalXpAfter: result.value.totalXp,
      currencyXpAfter: result.value.currencyXp,
      refCode: refCode || null,
      createdByUserId: admin.id,
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/admin/players/${character.playerId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return {
    ok: true,
    message: `+${Math.floor(amountRaw)} XP — Total ${result.value.totalXp}, Currency ${result.value.currencyXp}.`,
  };
}

// Posts a credits delta and an XP grant together under one shared description —
// a mission payout touches both ledgers, and posting them as two separate
// actions risks a half-applied reward if the admin only completes one. Either
// amount can be left blank to post a single-ledger entry through this form.
export async function postMissionPayout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const playerId = textField(formData, "playerId");
  const characterId = textField(formData, "characterId");
  const description = textField(formData, "description", TEXT_LIMITS.ledgerDescription);
  const refCode = textField(formData, "refCode", TEXT_LIMITS.refCode);
  if (!playerId) return { error: "Missing player reference." };
  if (!description) return { error: "A description is required for the ledger." };

  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const xpRaw = String(formData.get("xp") ?? "").trim();
  if (!creditsRaw && !xpRaw) {
    return { error: "Enter a credit amount, an XP amount, or both." };
  }

  let creditsDelta: number | null = null;
  if (creditsRaw) {
    const parsed = parseSignedInt(formData.get("credits"));
    if (!parsed.ok) return { error: parsed.error };
    creditsDelta = parsed.value;
  }

  let xpAmount: number | null = null;
  if (xpRaw) {
    const n = Number(xpRaw);
    if (!Number.isFinite(n)) return { error: "XP must be a whole number." };
    xpAmount = Math.floor(n);
    if (!characterId) {
      return { error: "This operator has no character to grant XP to." };
    }
  }

  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player) return { error: "Player not found." };

  let creditsResult: { value: number } | null = null;
  if (creditsDelta !== null) {
    const result = applyCreditsDelta(player.credits, creditsDelta);
    if (!result.ok) return { error: result.error };
    creditsResult = result;
  }

  let character: typeof characters.$inferSelect | null = null;
  let xpResult: { value: { totalXp: number; currencyXp: number } } | null = null;
  if (xpAmount !== null && characterId) {
    character = (await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    })) ?? null;
    if (!character) return { error: "Character not found." };
    const result = applyXpGrant(character.totalXp, character.currencyXp, xpAmount);
    if (!result.ok) return { error: result.error };
    xpResult = result;
  }

  if (creditsResult && xpResult && character) {
    await db.batch([
      db
        .update(players)
        .set({ credits: creditsResult.value, updatedAt: new Date() })
        .where(eq(players.id, playerId)),
      db.insert(creditLedger).values({
        playerId,
        description,
        delta: creditsDelta!,
        balanceAfter: creditsResult.value,
        refCode: refCode || null,
        createdByUserId: admin.id,
      }),
      db
        .update(characters)
        .set({
          totalXp: xpResult.value.totalXp,
          currencyXp: xpResult.value.currencyXp,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId)),
      db.insert(xpLedger).values({
        characterId,
        description,
        delta: xpAmount!,
        totalXpAfter: xpResult.value.totalXp,
        currencyXpAfter: xpResult.value.currencyXp,
        refCode: refCode || null,
        createdByUserId: admin.id,
      }),
    ]);
  } else if (creditsResult) {
    await db.batch([
      db
        .update(players)
        .set({ credits: creditsResult.value, updatedAt: new Date() })
        .where(eq(players.id, playerId)),
      db.insert(creditLedger).values({
        playerId,
        description,
        delta: creditsDelta!,
        balanceAfter: creditsResult.value,
        refCode: refCode || null,
        createdByUserId: admin.id,
      }),
    ]);
  } else if (xpResult && character) {
    await db.batch([
      db
        .update(characters)
        .set({
          totalXp: xpResult.value.totalXp,
          currencyXp: xpResult.value.currencyXp,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId)),
      db.insert(xpLedger).values({
        characterId,
        description,
        delta: xpAmount!,
        totalXpAfter: xpResult.value.totalXp,
        currencyXpAfter: xpResult.value.currencyXp,
        refCode: refCode || null,
        createdByUserId: admin.id,
      }),
    ]);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/");
  revalidatePath("/roster");
  if (character) revalidatePath(`/roster/${character.slug}`);

  const parts: string[] = [];
  if (creditsResult) parts.push(`${creditsDelta! >= 0 ? "+" : ""}${creditsDelta} Cr`);
  if (xpResult) parts.push(`+${xpAmount} XP`);
  return { ok: true, message: `${parts.join(" · ")} posted.` };
}

// Approves a pending character application → it joins the active roster.
export async function approveCharacter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const characterId = textField(formData, "characterId");
  if (!characterId) return { error: "Missing character reference." };

  const db = getDb();
  const [row] = await db
    .update(characters)
    .set({ approved: true, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning({ slug: characters.slug, playerId: characters.playerId });
  if (!row) return { error: "Application not found." };

  revalidateCharacter(row.slug, row.playerId);
  return { ok: true, message: "Application approved." };
}

// Denies an application by deleting the sheet (denial is final — the player
// re-applies from scratch). The player account itself is untouched.
export async function denyCharacter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const characterId = textField(formData, "characterId");
  if (!characterId) return { error: "Missing character reference." };

  const db = getDb();
  const [row] = await db
    .delete(characters)
    .where(eq(characters.id, characterId))
    .returning({ playerId: characters.playerId });
  if (!row) return { error: "Application not found." };

  revalidatePath("/admin");
  revalidatePath(`/admin/players/${row.playerId}`);
  return { ok: true, message: "Application denied and removed." };
}

// Permanently removes a player account: the Clerk identity first, then the DB
// user row (cascades the player, character, and ledger). Admin accounts are
// protected. Redirects to the roster on success.
export async function deletePlayerAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const playerId = textField(formData, "playerId");
  if (!playerId) return { error: "Missing player reference." };

  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    with: { user: true },
  });
  if (!player) return { error: "Player not found." };
  if (player.user?.role === "admin") {
    return { error: "Admin accounts can't be removed here." };
  }

  try {
    const client = await clerkClient();
    await client.users.deleteUser(player.userId);
  } catch (err) {
    return {
      error: `Could not remove the Clerk identity: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  // Cascades to players → characters → credit_ledger via FK onDelete.
  try {
    await db.delete(users).where(eq(users.id, player.userId));
  } catch (err) {
    // The Clerk identity is already gone at this point; surface the DB failure
    // so the DM knows the records still need clearing (rather than a silent hang).
    return {
      error: `Removed the sign-in, but clearing the records failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/roster");
  redirect("/admin");
}

// Postgres unique-violation → a friendly message; slug and email are the two
// unique columns a form can realistically collide on.
function dbErrorMessage(err: unknown, slug: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("duplicate key") || msg.includes("unique")) {
    if (msg.includes("slug")) {
      return `Callsign "${slug}" is already taken by another operator.`;
    }
    if (msg.includes("player_id")) {
      return "This player already has a character.";
    }
    return "That value is already in use.";
  }
  return `Database error: ${msg}`;
}

// Clerk surfaces validation problems (email taken, weak/compromised password) in
// a structured `errors` array — pull the first human-readable message out.
function clerkErrorMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown[] }).errors)
  ) {
    const first = (err as { errors: { longMessage?: string; message?: string }[] })
      .errors[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return err instanceof Error ? err.message : "Failed to create the account.";
}
