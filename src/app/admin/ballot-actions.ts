"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ballots, ballotOptions, type NewBallot, type NewBallotOption } from "@/lib/schema";
import { TEXT_LIMITS, MAX_BALLOT_OPTIONS } from "@/lib/game-rules";
import type { Result } from "@/lib/ledger";

/*
 * Ballot CRUD (Phase 7, admin only). Mirrors app/admin/mission-actions.ts's
 * shape: requireAdmin() -> validate -> mutate -> revalidatePath. Options are
 * only ever set at creation (parseOptionsField) — updateBallot only touches
 * the ballot's own fields, since an option may already have votes against
 * it by the time an admin wants to edit; delete-and-recreate the ballot is
 * the escape hatch for a typo'd option set.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

// Parses the client-serialized option rows (see ballot-form.tsx). The client
// can't be trusted, so length and per-label content are re-checked here
// regardless of what the JSON claims to contain.
function parseOptionsField(raw: FormDataEntryValue | null): Result<string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? "[]"));
  } catch {
    return { ok: false, error: "Malformed option data." };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "Malformed option data." };

  const labels: string[] = [];
  for (const row of parsed) {
    const label = String(row ?? "").trim().slice(0, TEXT_LIMITS.ballotOptionLabel);
    if (label) labels.push(label);
  }
  if (labels.length < 2) return { ok: false, error: "A ballot needs at least 2 options." };
  if (labels.length > MAX_BALLOT_OPTIONS) {
    return { ok: false, error: `A ballot may have at most ${MAX_BALLOT_OPTIONS} options.` };
  }
  return { ok: true, value: labels };
}

function parseBallotFields(
  formData: FormData,
): { ok: true; values: Omit<NewBallot, "id" | "createdByUserId" | "status" | "closedAt"> } | { ok: false; error: string } {
  const title = textField(formData, "title", TEXT_LIMITS.ballotTitle);
  if (!title) return { ok: false, error: "A ballot title is required." };

  const description = textField(formData, "description", TEXT_LIMITS.ballotDescription) || null;

  const hasDeadline = textField(formData, "hasDeadline") === "limited";
  let opsDeadline: number | null = null;
  if (hasDeadline) {
    const raw = textField(formData, "opsDeadline");
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: "A time-limited ballot needs a deadline of 1 or more ops." };
    }
    opsDeadline = n;
  }

  return { ok: true, values: { title, description, opsDeadline } };
}

// Authors a new ballot with its option slate.
export async function createBallot(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = parseBallotFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const parsedOptions = parseOptionsField(formData.get("options"));
  if (!parsedOptions.ok) return { error: parsedOptions.error };

  const values: NewBallot = { ...parsed.values, createdByUserId: admin.id };

  const db = getDb();
  let ballotId: string;
  try {
    // neon-http has no transaction support (see createCard), so the ballot
    // and its options are inserted separately; if the options insert fails,
    // the ballot is deleted to avoid leaving an orphaned, option-less ballot.
    const [ballot] = await db.insert(ballots).values(values).returning({ id: ballots.id });
    ballotId = ballot.id;
  } catch (err) {
    return { error: `Database error: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const rows: NewBallotOption[] = parsedOptions.value.map((label, i) => ({
      ballotId,
      label,
      sortOrder: i,
    }));
    await db.insert(ballotOptions).values(rows);
  } catch (err) {
    await db.delete(ballots).where(eq(ballots.id, ballotId));
    return { error: `Database error: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/admin/ballots");
  revalidatePath("/ballots");
  revalidatePath("/");
  return { ok: true, message: `Ballot "${values.title}" opened.` };
}

// Edits a ballot's own fields. Options are fixed at creation — see the
// file-level comment above.
export async function updateBallot(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const ballotId = textField(formData, "ballotId");
  if (!ballotId) return { error: "Missing ballot reference." };

  const parsed = parseBallotFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = getDb();
  const [updated] = await db
    .update(ballots)
    .set({ ...parsed.values, updatedAt: new Date() })
    .where(eq(ballots.id, ballotId))
    .returning({ id: ballots.id });
  if (!updated) return { error: "Ballot not found." };

  revalidatePath("/admin/ballots");
  revalidatePath(`/admin/ballots/${ballotId}`);
  revalidatePath("/ballots");
  revalidatePath(`/ballots/${ballotId}`);
  revalidatePath("/");
  return { ok: true, message: `Ballot "${parsed.values.title}" updated.` };
}

// The only manual close path — symmetric with the ops-deadline tick's
// automatic close. Guarded so a double-submit can't "close" an already
// closed ballot and stomp closedAt.
export async function closeBallot(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const ballotId = textField(formData, "ballotId");
  if (!ballotId) return { error: "Missing ballot reference." };

  const db = getDb();
  const [updated] = await db
    .update(ballots)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(eq(ballots.id, ballotId))
    .returning({ id: ballots.id });
  if (!updated) return { error: "Ballot not found." };

  revalidatePath("/admin/ballots");
  revalidatePath(`/admin/ballots/${ballotId}`);
  revalidatePath("/ballots");
  revalidatePath(`/ballots/${ballotId}`);
  revalidatePath("/");
  return { ok: true, message: "Ballot closed." };
}

export async function deleteBallot(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const ballotId = textField(formData, "ballotId");
  if (!ballotId) return { error: "Missing ballot reference." };

  const db = getDb();
  await db.delete(ballots).where(eq(ballots.id, ballotId));

  revalidatePath("/admin/ballots");
  revalidatePath("/ballots");
  revalidatePath("/");
  return { ok: true, message: "Ballot deleted." };
}
