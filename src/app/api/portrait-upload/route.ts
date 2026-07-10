import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { characters } from "@/lib/schema";
import { PORTRAIT_MIME_TYPES, MAX_PORTRAIT_BYTES } from "@/lib/game-rules";

/*
 * Token-issuance endpoint for direct browser-to-Blob portrait uploads (see
 * app/roster/[slug]/portrait.tsx). A regular server action can't carry a
 * 20MB GIF — Vercel's serverless functions cap request bodies at 4.5MB — so
 * the file goes straight from the browser to Blob storage, and this route
 * only ever sees the small token-request payload the SDK sends first.
 * Ownership is checked here (token issuance), not just on the eventual DB
 * write, so a signed-in stranger can't mint a token for someone else's
 * character.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("You must be signed in.");

        const characterId =
          clientPayload && JSON.parse(clientPayload)?.characterId;
        if (!characterId || typeof characterId !== "string") {
          throw new Error("Missing character reference.");
        }

        const db = getDb();
        const character = await db.query.characters.findFirst({
          where: eq(characters.id, characterId),
          with: { player: true },
        });
        if (!character) throw new Error("Character not found.");
        if (character.player.userId !== user.id && user.role !== "admin") {
          throw new Error("You can only edit your own case file.");
        }

        return {
          allowedContentTypes: [...PORTRAIT_MIME_TYPES],
          maximumSizeInBytes: MAX_PORTRAIT_BYTES,
          addRandomSuffix: true,
        };
      },
      // No onUploadCompleted: Vercel can't reach this callback on localhost
      // during development, so the DB write can't depend on it firing. The
      // client instead calls the savePortraitUrl server action right after
      // upload() resolves (see portrait.tsx).
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }
}
