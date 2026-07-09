"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne, inArray, isNotNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { put, del } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  missions,
  missionAssignments,
  missionAttachments,
  players,
  characters,
  creditLedger,
  xpLedger,
  ballots,
  type NewMission,
  type NewMissionAssignment,
} from "@/lib/schema";
import { TEXT_LIMITS, MAX_MISSION_ATTACHMENTS, MAX_ATTACHMENT_BYTES, ATTACHMENT_MIME_TYPES } from "@/lib/game-rules";
import { applyCreditsDelta, applyXpGrant } from "@/lib/ledger";
import { splitPayoutEvenly, tickUrgentDeadline } from "@/lib/missions";
import { tickBallotDeadline } from "@/lib/ballots";
import { getMission } from "@/lib/mission-data";

/*
 * Mission CRUD + assignment + completion (Phase 5, admin only). Mirrors
 * app/admin/facility-actions.ts's shape: requireAdmin() -> validate -> mutate ->
 * revalidatePath. Status transitions (active/failed/complete) are dedicated
 * actions rather than an editable form field — completion in particular moves
 * money and ticks other missions' Urgent deadlines, so it can't be a
 * side-effect-free field edit.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

function intField(formData: FormData, key: string, fallback: number): number {
  const raw = textField(formData, key);
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const RISKS = ["low", "moderate", "high", "severe"] as const;

function parseMissionFields(
  formData: FormData,
): { ok: true; values: Omit<NewMission, "id" | "createdByUserId"> } | { ok: false; error: string } {
  const title = textField(formData, "title", TEXT_LIMITS.missionTitle);
  if (!title) return { ok: false, error: "A mission title is required." };

  const sector = textField(formData, "sector", TEXT_LIMITS.missionSector) || null;
  const briefing = textField(formData, "briefing", TEXT_LIMITS.missionBriefing) || null;

  const payoutCredits = intField(formData, "payoutCredits", 0);
  if (payoutCredits < 0) return { ok: false, error: "Credit payout must be zero or more." };

  const payoutXp = intField(formData, "payoutXp", 0);
  if (payoutXp < 0) return { ok: false, error: "XP payout must be zero or more." };

  const risk = textField(formData, "risk") as (typeof RISKS)[number];
  if (!RISKS.includes(risk)) return { ok: false, error: "Pick a risk level." };

  const urgent = textField(formData, "urgent") === "urgent";
  let urgentDeadline: number | null = null;
  if (urgent) {
    urgentDeadline = intField(formData, "urgentDeadline", NaN);
    if (!Number.isInteger(urgentDeadline) || urgentDeadline < 1) {
      return { ok: false, error: "Urgent missions need a deadline of 1 or more ops." };
    }
  }

  return {
    ok: true,
    values: {
      title,
      sector,
      briefing,
      payoutCredits,
      payoutXp,
      risk,
      urgent,
      urgentDeadline,
    },
  };
}

export async function createMission(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = parseMissionFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const values: NewMission = { ...parsed.values, createdByUserId: admin.id };
  const db = getDb();
  await db.insert(missions).values(values);

  revalidatePath("/admin/missions");
  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true, message: `Mission "${values.title}" posted.` };
}

export async function updateMission(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const missionId = textField(formData, "missionId");
  if (!missionId) return { error: "Missing mission reference." };

  const parsed = parseMissionFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = getDb();
  const [updated] = await db
    .update(missions)
    .set({ ...parsed.values, updatedAt: new Date() })
    .where(eq(missions.id, missionId))
    .returning({ id: missions.id });
  if (!updated) return { error: "Mission not found." };

  revalidatePath("/admin/missions");
  revalidatePath(`/admin/missions/${missionId}`);
  revalidatePath("/missions");
  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/");
  return { ok: true, message: `Mission "${parsed.values.title}" updated.` };
}

export async function deleteMission(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const missionId = textField(formData, "missionId");
  if (!missionId) return { error: "Missing mission reference." };

  const db = getDb();
  // Fetch attachment URLs before the delete cascades their rows away — the
  // blob cleanup below is best-effort and must not block mission deletion.
  const attachments = await db.query.missionAttachments.findMany({
    where: eq(missionAttachments.missionId, missionId),
    columns: { url: true },
  });

  await db.delete(missions).where(eq(missions.id, missionId));

  if (attachments.length > 0) {
    try {
      await del(attachments.map((a) => a.url));
    } catch (err) {
      console.error("Blob cleanup failed after mission deletion:", err);
    }
  }

  revalidatePath("/admin/missions");
  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true, message: "Mission deleted." };
}

// Photo attachments (case-file gallery, detail pages only). Uploaded one at
// a time by design — Vercel's platform-level request-body ceiling (4.5MB,
// unaffected by next.config's bodySizeLimit) makes a true multi-file batch
// input a real, badly-surfaced failure mode with real phone-photo sizes.
export async function uploadMissionAttachment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const missionId = textField(formData, "missionId");
  if (!missionId) return { error: "Missing mission reference." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a photo to upload." };

  const db = getDb();
  const existing = await db.query.missionAttachments.findMany({
    where: eq(missionAttachments.missionId, missionId),
    columns: { id: true },
  });
  if (existing.length >= MAX_MISSION_ATTACHMENTS) {
    return { error: `This mission already has the maximum of ${MAX_MISSION_ATTACHMENTS} photos.` };
  }

  if (!ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_MIME_TYPES)[number])) {
    return { error: "Only PNG, JPEG, WebP, or GIF images are allowed." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: `Photo is too large — max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB.` };
  }

  // Strip path separators and other unsafe characters from the original
  // filename — it lands directly in the blob pathname below, and a stray
  // "/" would create an unintended nested key rather than a flat file.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "photo";

  let blob;
  try {
    blob = await put(`missions/${missionId}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch (err) {
    console.error("Blob upload failed:", err);
    return { error: "Upload failed — check your connection and try again." };
  }
  await db.insert(missionAttachments).values({ missionId, url: blob.url });

  revalidatePath(`/admin/missions/${missionId}`);
  revalidatePath(`/missions/${missionId}`);
  return { ok: true, message: "Photo added." };
}

export async function deleteMissionAttachment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const attachmentId = textField(formData, "attachmentId");
  if (!attachmentId) return { error: "Missing photo reference." };

  const db = getDb();
  const [row] = await db
    .delete(missionAttachments)
    .where(eq(missionAttachments.id, attachmentId))
    .returning({ missionId: missionAttachments.missionId, url: missionAttachments.url });
  if (!row) return { error: "Photo not found." };

  try {
    await del(row.url);
  } catch (err) {
    console.error("Blob cleanup failed after photo deletion:", err);
  }

  revalidatePath(`/admin/missions/${row.missionId}`);
  revalidatePath(`/missions/${row.missionId}`);
  return { ok: true, message: "Photo removed." };
}

// Quick status toggles (mirrors setShopOpen). "complete" always goes through
// completeMission below so a payout is never skipped. Each target is only
// legal from specific current statuses — validated server-side via the WHERE
// clause rather than trusting the client to only show valid buttons.
const STATUS_TRANSITION_SOURCES = {
  active: ["available"],
  failed: ["available", "active"],
  available: ["failed"], // the "revert" path — undoes a mistaken/premature failure
} as const;

export async function setMissionStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const missionId = textField(formData, "missionId");
  const status = textField(formData, "status");
  if (!missionId) return { error: "Missing mission reference." };
  if (status !== "active" && status !== "failed" && status !== "available") {
    return { error: "Invalid status." };
  }

  const db = getDb();
  const isRevert = status === "available";
  const [updated] = await db
    .update(missions)
    .set(
      isRevert
        ? { status, urgent: false, urgentDeadline: null, updatedAt: new Date() }
        : { status, updatedAt: new Date() },
    )
    .where(and(eq(missions.id, missionId), inArray(missions.status, STATUS_TRANSITION_SOURCES[status])))
    .returning({ id: missions.id });
  if (!updated) return { error: "Mission isn't in a state that allows this change." };

  revalidatePath("/admin/missions");
  revalidatePath(`/admin/missions/${missionId}`);
  revalidatePath("/missions");
  revalidatePath("/");
  const message =
    status === "active"
      ? "Mission marked active."
      : status === "failed"
        ? "Mission marked failed."
        : "Mission reverted to available.";
  return { ok: true, message };
}

// Promotes a self-expressed interest row to a confirmed assignment.
export async function confirmAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const assignmentId = textField(formData, "assignmentId");
  if (!assignmentId) return { error: "Missing assignment reference." };

  const db = getDb();
  const [row] = await db
    .update(missionAssignments)
    .set({ state: "assigned" })
    .where(and(eq(missionAssignments.id, assignmentId), eq(missionAssignments.state, "interested")))
    .returning({ missionId: missionAssignments.missionId });
  if (!row) return { error: "Interest row not found (already assigned?)." };

  revalidatePath(`/admin/missions/${row.missionId}`);
  revalidatePath("/missions");
  return { ok: true, message: "Operator assigned." };
}

// DM-direct assign, bypassing the interest step. Upserts: an existing
// interested row is promoted in place rather than duplicated.
export async function assignCharacterDirect(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const missionId = textField(formData, "missionId");
  const characterId = textField(formData, "characterId");
  if (!missionId || !characterId) return { error: "Pick an operator to assign." };

  const values: NewMissionAssignment = { missionId, characterId, state: "assigned" };
  const db = getDb();
  await db
    .insert(missionAssignments)
    .values(values)
    .onConflictDoUpdate({
      target: [missionAssignments.missionId, missionAssignments.characterId],
      set: { state: "assigned" },
    });

  revalidatePath(`/admin/missions/${missionId}`);
  revalidatePath("/missions");
  return { ok: true, message: "Operator assigned." };
}

// Serves both "reject interest" and "unassign" — same row shape, the caller's
// button label just reflects the row's current state.
export async function removeAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const assignmentId = textField(formData, "assignmentId");
  if (!assignmentId) return { error: "Missing assignment reference." };

  const db = getDb();
  const [row] = await db
    .delete(missionAssignments)
    .where(eq(missionAssignments.id, assignmentId))
    .returning({ missionId: missionAssignments.missionId });
  if (!row) return { error: "Assignment not found." };

  revalidatePath(`/admin/missions/${row.missionId}`);
  revalidatePath("/missions");
  return { ok: true, message: "Removed." };
}

// The core payout action: splits the mission's total credit and XP pots
// evenly across its assigned operators — credits land on the player,
// XP on the character via the same applyXpGrant convention as an admin's
// manual grant (raises both totalXp and currencyXp) — marks the mission
// complete, then best-effort ticks every other active Urgent mission's
// deadline. Non-transactional, try/catch-guarded convention as the facility
// restock tick in app/admin/actions.ts's postMissionPayout.
export async function completeMission(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const missionId = textField(formData, "missionId");
  if (!missionId) return { error: "Missing mission reference." };

  const mission = await getMission(missionId);
  if (!mission) return { error: "Mission not found." };
  if (mission.status === "complete" || mission.status === "failed") {
    return { error: "This mission is already resolved." };
  }

  const assigned = mission.assignments.filter((a) => a.state === "assigned");
  if (assigned.length === 0) {
    return { error: "Assign at least one operator before completing." };
  }

  const db = getDb();
  const { perOperator: perOperatorCredits } = splitPayoutEvenly(mission.payoutCredits, assigned.length);
  const { perOperator: perOperatorXp } = splitPayoutEvenly(mission.payoutXp, assigned.length);

  if (perOperatorCredits === 0 && perOperatorXp === 0) {
    await db
      .update(missions)
      .set({ status: "complete", updatedAt: new Date() })
      .where(eq(missions.id, missionId));
  } else {
    const results: {
      character: (typeof assigned)[number]["character"];
      creditBalance: number | null;
      xp: { totalXp: number; currencyXp: number } | null;
    }[] = [];
    for (const a of assigned) {
      let creditBalance: number | null = null;
      if (perOperatorCredits > 0) {
        const result = applyCreditsDelta(a.character.player.credits, perOperatorCredits);
        if (!result.ok) return { error: `${a.character.callsign}: ${result.error}` };
        creditBalance = result.value;
      }
      let xp: { totalXp: number; currencyXp: number } | null = null;
      if (perOperatorXp > 0) {
        const result = applyXpGrant(a.character.totalXp, a.character.currencyXp, perOperatorXp);
        if (!result.ok) return { error: `${a.character.callsign}: ${result.error}` };
        xp = result.value;
      }
      results.push({ character: a.character, creditBalance, xp });
    }

    // db.batch requires a statically non-empty tuple; the batch is genuinely
    // variable-length (one update+insert pair per assigned operator per
    // ledger touched), so the dynamically built array is asserted into that
    // shape — safe here since `results` always has at least one entry in
    // this branch.
    const batchItems: BatchItem<"pg">[] = [
      ...results
        .filter((r) => r.creditBalance !== null)
        .map((r) =>
          db
            .update(players)
            .set({ credits: r.creditBalance!, updatedAt: new Date() })
            .where(eq(players.id, r.character.player.id)),
        ),
      ...results
        .filter((r) => r.creditBalance !== null)
        .map((r) =>
          db.insert(creditLedger).values({
            playerId: r.character.player.id,
            description: `Mission payout — ${mission.title}`,
            delta: perOperatorCredits,
            balanceAfter: r.creditBalance!,
            refCode: mission.id,
          }),
        ),
      ...results
        .filter((r) => r.xp !== null)
        .map((r) =>
          db
            .update(characters)
            .set({ totalXp: r.xp!.totalXp, currencyXp: r.xp!.currencyXp, updatedAt: new Date() })
            .where(eq(characters.id, r.character.id)),
        ),
      ...results
        .filter((r) => r.xp !== null)
        .map((r) =>
          db.insert(xpLedger).values({
            characterId: r.character.id,
            description: `Mission payout — ${mission.title}`,
            delta: perOperatorXp,
            totalXpAfter: r.xp!.totalXp,
            currencyXpAfter: r.xp!.currencyXp,
            refCode: mission.id,
          }),
        ),
      db.update(missions).set({ status: "complete", updatedAt: new Date() }).where(eq(missions.id, missionId)),
    ];
    await db.batch(batchItems as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  }

  try {
    const others = await db.query.missions.findMany({
      where: and(
        inArray(missions.status, ["available", "active"]),
        ne(missions.id, missionId),
        eq(missions.urgent, true),
      ),
    });
    for (const other of others) {
      if (other.urgentDeadline == null) continue;
      const { nextDeadline, failed } = tickUrgentDeadline(other.urgentDeadline);
      await db
        .update(missions)
        .set({
          urgentDeadline: nextDeadline,
          status: failed ? "failed" : other.status,
          updatedAt: new Date(),
        })
        .where(eq(missions.id, other.id));
    }
  } catch (err) {
    console.error("Urgent deadline tick failed after mission completion:", err);
  }

  // Independent try/catch (not merged into the Urgent-tick block above) so
  // one tick type failing can't abort the other. Unlike the Urgent tick,
  // there's no ne(ballots.id, ...) exclusion — a ballot is never "the thing
  // that just completed."
  try {
    const openBallots = await db.query.ballots.findMany({
      where: and(eq(ballots.status, "open"), isNotNull(ballots.opsDeadline)),
    });
    for (const ballot of openBallots) {
      const { nextDeadline, closed } = tickBallotDeadline(ballot.opsDeadline!);
      await db
        .update(ballots)
        .set({
          opsDeadline: nextDeadline,
          status: closed ? "closed" : ballot.status,
          closedAt: closed ? new Date() : ballot.closedAt,
          updatedAt: new Date(),
        })
        .where(eq(ballots.id, ballot.id));
    }
  } catch (err) {
    console.error("Ballot deadline tick failed after mission completion:", err);
  }

  revalidatePath("/admin/missions");
  revalidatePath(`/admin/missions/${missionId}`);
  revalidatePath("/missions");
  revalidatePath("/admin/ballots");
  revalidatePath("/ballots");
  revalidatePath("/");

  const parts: string[] = [];
  if (perOperatorCredits > 0) parts.push(`${perOperatorCredits} Cr`);
  if (perOperatorXp > 0) parts.push(`${perOperatorXp} XP`);
  const perOperatorMsg =
    parts.length > 0 ? `${parts.join(" and ")} to each of ${assigned.length} operator(s).` : "No payout.";
  return { ok: true, message: `Mission complete. ${perOperatorMsg}` };
}
