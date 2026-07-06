import { eq, asc } from "drizzle-orm";
import { getDb } from "./db";
import { characters, players, type Character, type Player } from "./schema";
import type { CharacterStatus, StatKey } from "./status";

/*
 * Character read model (Phase 2). Flattens the DB `characters` row (plus the
 * owning player's gold) into the nested shape the Case File / roster / dashboard
 * render — the same shape the Phase 0 mock fixtures used, so the presentational
 * components didn't have to change when the data went live.
 */
export interface CharacterView {
  id: string;
  playerId: string;
  callsign: string;
  slug: string;
  name: string;
  rank: string | null;
  role: string | null;
  status: CharacterStatus;
  approved: boolean;
  totalXp: number;
  currencyXp: number;
  hp: { current: number; max: number };
  energy: { current: number; max: number };
  energyRegen: number;
  ammo: { current: number; max: number };
  stats: Record<StatKey, number>;
  gold: number;
  bio: string | null;
}

export function toCharacterView(
  c: Character,
  player: Pick<Player, "gold">,
): CharacterView {
  return {
    id: c.id,
    playerId: c.playerId,
    callsign: c.callsign,
    slug: c.slug,
    name: c.name,
    rank: c.rank,
    role: c.role,
    status: c.status,
    approved: c.approved,
    totalXp: c.totalXp,
    currencyXp: c.currencyXp,
    hp: { current: c.hpCurrent, max: c.hpMax },
    energy: { current: c.energyCurrent, max: c.energyMax },
    energyRegen: c.energyRegen,
    ammo: { current: c.ammoCurrent, max: c.ammoMax },
    stats: {
      tech: c.statTech,
      precision: c.statPrecision,
      strength: c.statStrength,
      immunity: c.statImmunity,
      resilience: c.statResilience,
      agility: c.statAgility,
    },
    gold: player.gold,
    bio: c.bio,
  };
}

/** Approved characters only, callsign-ordered, for the roster + dashboard. */
export async function getRosterViews(): Promise<CharacterView[]> {
  const db = getDb();
  const rows = await db.query.characters.findMany({
    where: eq(characters.approved, true),
    with: { player: true },
    orderBy: [asc(characters.callsign)],
  });
  return rows.map((c) => toCharacterView(c, c.player));
}

export interface PendingApplication {
  view: CharacterView;
  applicantName: string;
  applicantEmail: string;
  submittedAt: Date;
}

/** Unapproved character applications awaiting DM review (admin queue). */
export async function getPendingApplications(): Promise<PendingApplication[]> {
  const db = getDb();
  const rows = await db.query.characters.findMany({
    where: eq(characters.approved, false),
    with: { player: { with: { user: true } } },
    orderBy: [asc(characters.createdAt)],
  });
  return rows.map((c) => ({
    view: toCharacterView(c, c.player),
    applicantName:
      c.player.name || c.player.user?.displayName || c.player.user?.email || "—",
    applicantEmail: c.player.user?.email ?? "",
    submittedAt: c.createdAt,
  }));
}

export type ViewerCharacterState =
  | { kind: "none"; player: Player | null }
  | { kind: "pending"; player: Player; character: Character }
  | { kind: "approved"; player: Player; character: Character };

/**
 * The signed-in player's character situation, used to gate the apply flow and
 * render the right home-page prompt. Admins have no player row → "none".
 */
export async function getViewerCharacterState(
  userId: string,
): Promise<ViewerCharacterState> {
  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.userId, userId),
    with: { character: true },
  });
  if (!player) return { kind: "none", player: null };
  if (!player.character) return { kind: "none", player };
  return {
    kind: player.character.approved ? "approved" : "pending",
    player,
    character: player.character,
  };
}

export interface CharacterDetail {
  view: CharacterView;
  ownerUserId: string;
}

/** One character by slug, with the owning player's user id for ownership checks. */
export async function getCharacterBySlug(
  slug: string,
): Promise<CharacterDetail | null> {
  const db = getDb();
  const row = await db.query.characters.findFirst({
    where: eq(characters.slug, slug),
    with: { player: { with: { user: true } } },
  });
  if (!row) return null;
  return {
    view: toCharacterView(row, row.player),
    ownerUserId: row.player.userId,
  };
}

/**
 * URL-safe slug from a callsign. Callsigns are short and mostly A–Z, so this is
 * simple; uniqueness is enforced by the DB (characters.slug unique) and the
 * caller surfaces a clash as a validation error.
 */
export function slugifyCallsign(callsign: string): string {
  return callsign
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { eq, players };
