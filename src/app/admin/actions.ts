"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users, players, characters, goldLedger } from "@/lib/schema";
import { slugifyCallsign } from "@/lib/characters";
import { CHARACTER_STATUSES, type CharacterStatus } from "@/lib/status";
import { applyGoldDelta, clampResource, parseSignedInt } from "@/lib/ledger";

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

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
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
      gold: 0,
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
// Phase 2 — character CRUD, player info, and gold ledger (admin only).
// ---------------------------------------------------------------------------

export type FormState = { ok?: boolean; error?: string; message?: string };

// Non-negative integer from a form field, with a fallback when blank.
function intField(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function textField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// The full set of editable character columns, shared by create + update. Current
// resource values are clamped to their max so the sheet can never show 30/20.
function parseCharacterFields(formData: FormData):
  | { ok: true; values: typeof characters.$inferInsert }
  | { ok: false; error: string } {
  const callsign = textField(formData, "callsign");
  const name = textField(formData, "name");
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
    rank: textField(formData, "rank") || null,
    role: textField(formData, "role") || null,
    status,
    level: Math.max(1, intField(formData, "level", 1)),
    xp: intField(formData, "xp"),
    hpMax,
    hpCurrent: clampResource(intField(formData, "hpCurrent"), hpMax),
    energyMax,
    energyCurrent: clampResource(intField(formData, "energyCurrent"), energyMax),
    ammoMax,
    ammoCurrent: clampResource(intField(formData, "ammoCurrent"), ammoMax),
    statTech: intField(formData, "statTech"),
    statPrecision: intField(formData, "statPrecision"),
    statStrength: intField(formData, "statStrength"),
    statImmunity: intField(formData, "statImmunity"),
    statResilience: intField(formData, "statResilience"),
    statAgility: intField(formData, "statAgility"),
    bio: textField(formData, "bio") || null,
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
    await db
      .insert(characters)
      .values({ ...parsed.values, playerId, slug });
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

// Edits player-account info (operator name). Gold is handled by adjustGold so
// every balance change is ledgered.
export async function updatePlayer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const playerId = textField(formData, "playerId");
  if (!playerId) return { error: "Missing player reference." };

  const name = textField(formData, "name");
  const db = getDb();
  await db
    .update(players)
    .set({ name: name || null, updatedAt: new Date() })
    .where(eq(players.id, playerId));

  revalidatePath("/admin");
  revalidatePath(`/admin/players/${playerId}`);
  return { ok: true, message: "Player info updated." };
}

// Applies a gold delta and appends the ledger row in a single batch so the
// balance and its audit entry can't diverge. Adjustment rules live in lib/ledger.
export async function adjustGold(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const playerId = textField(formData, "playerId");
  const description = textField(formData, "description");
  const refCode = textField(formData, "refCode");
  if (!playerId) return { error: "Missing player reference." };
  if (!description) return { error: "A description is required for the ledger." };

  const parsedDelta = parseSignedInt(formData.get("amount"));
  if (!parsedDelta.ok) return { error: parsedDelta.error };

  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player) return { error: "Player not found." };

  const result = applyGoldDelta(player.gold, parsedDelta.value);
  if (!result.ok) return { error: result.error };

  await db.batch([
    db
      .update(players)
      .set({ gold: result.value, updatedAt: new Date() })
      .where(eq(players.id, playerId)),
    db.insert(goldLedger).values({
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
