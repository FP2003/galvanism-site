import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { users, players } from "@/lib/schema";

/*
 * Clerk → app sync, the one direction that didn't otherwise exist: deleting a
 * Clerk account left the `users`/`players`/`characters` rows (and the roster
 * entry) orphaned forever, since nothing ever deleted `users` in response.
 * Cascades on `players.userId`/`characters.playerId` (schema.ts) do the rest
 * once this row goes — this handler's only job is deleting it and cleaning up
 * the portrait blob first, since that lives outside Postgres.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 },
    );
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers." }, { status: 400 });
  }

  const payload = await request.text();

  let event: { type: string; data: { id?: string } };
  try {
    event = new Webhook(signingSecret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: { id?: string } };
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "user.deleted" && event.data.id) {
    const clerkUserId = event.data.id;
    const db = getDb();

    const player = await db.query.players.findFirst({
      where: eq(players.userId, clerkUserId),
      with: { character: true },
    });
    if (player?.character?.portraitUrl) {
      await del(player.character.portraitUrl);
    }

    await db.delete(users).where(eq(users.id, clerkUserId));
  }

  return NextResponse.json({ received: true });
}
