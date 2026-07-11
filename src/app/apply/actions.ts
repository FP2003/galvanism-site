"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { players, characters } from "@/lib/schema";
import { slugifyCallsign } from "@/lib/characters";
import { resilienceHpBonus, validateAttributeAllocation } from "@/lib/ledger";
import {
  BASE_HP,
  BASE_ENERGY,
  BASE_ENERGY_REGEN,
  IMMUNITY_BASE,
  ATTRIBUTE_BUDGET,
  POINT_BUY_ATTRIBUTES,
  TEXT_LIMITS,
} from "@/lib/game-rules";

export type ApplicationState = { error?: string };

// A signed-in player submits their character for DM approval (Phase 2). Base
// resources and Immunity are fixed by the rules in lib/game-rules; the player
// only picks callsign/name/backstory and the six-point attribute allocation.
// Lands as approved=false; the DM approves or denies.
export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const user = await requireUser();
  if (user.role === "admin") {
    return { error: "Admins manage sheets from Personnel Command, not here." };
  }

  const callsign = String(formData.get("callsign") ?? "").trim().slice(0, TEXT_LIMITS.callsign);
  const name = String(formData.get("name") ?? "").trim().slice(0, TEXT_LIMITS.name);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, TEXT_LIMITS.bio);
  if (!callsign) return { error: "A callsign is required." };
  if (!name) return { error: "An operator name is required." };

  const slug = slugifyCallsign(callsign);
  if (!slug) return { error: "Callsign must contain letters or numbers." };

  // Read + validate the point-buy against the fixed budget.
  const allocation = POINT_BUY_ATTRIBUTES.map((a) => {
    const raw = String(formData.get(a.key) ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) ? Math.floor(n) : NaN;
  });
  const validated = validateAttributeAllocation(allocation, ATTRIBUTE_BUDGET);
  if (!validated.ok) return { error: validated.error };
  const [tech, precision, strength, resilience, agility] = validated.value;

  const db = getDb();

  // Ensure the player has a profile row, then guard the 1:1 character rule.
  const existing = await db.query.players.findFirst({
    where: eq(players.userId, user.id),
    with: { character: true },
  });
  if (existing?.character) {
    return { error: "You already have a character on file." };
  }
  let playerId = existing?.id;
  if (!playerId) {
    const [created] = await db
      .insert(players)
      .values({ userId: user.id, name: name || null })
      .returning({ id: players.id });
    playerId = created.id;
  }

  try {
    await db.insert(characters).values({
      playerId,
      slug,
      callsign,
      name,
      bio: bio || null,
      rank: null,
      role: null,
      status: "standby",
      approved: false,
      hpMax: BASE_HP,
      // A new character starts full against their chosen Resilience allocation,
      // not the flat base — resilienceHpBonus is folded into hpMax everywhere
      // it's read, so hpCurrent has to account for it here too.
      hpCurrent: BASE_HP + resilienceHpBonus(resilience),
      energyMax: BASE_ENERGY,
      energyCurrent: BASE_ENERGY,
      energyRegen: BASE_ENERGY_REGEN,
      ammoMax: 0,
      ammoCurrent: 0,
      statImmunity: IMMUNITY_BASE,
      statTech: tech,
      statPrecision: precision,
      statStrength: strength,
      statResilience: resilience,
      statAgility: agility,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return {
        error: `Callsign "${callsign}" is already taken. Pick another.`,
      };
    }
    return { error: `Could not submit application: ${msg}` };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/");
}
