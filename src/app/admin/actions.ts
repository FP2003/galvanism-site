"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users, players } from "@/lib/schema";

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
