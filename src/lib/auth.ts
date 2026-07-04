import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, type User } from "./schema";

/*
 * Auth glue between Clerk (identity source of truth) and our Postgres `users`
 * table. Role is decided solely by the ADMIN_EMAILS allowlist (info/roadmap.md
 * Phase 1 — env-allowlist admin bootstrap), then mirrored into both the DB and
 * Clerk publicMetadata so middleware/UI can read it cheaply.
 */
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails.includes(email.toLowerCase());
}

/**
 * Resolves the current Clerk session to our DB user row, upserting it (and
 * syncing role) on the way. Returns null when signed out.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase() ??
    `${userId}@no-email.local`;
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    null;
  const role = isAdminEmail(email) ? "admin" : "player";

  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({ id: userId, email, displayName, role })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, displayName, role, updatedAt: new Date() },
    })
    .returning();

  // Mirror role into Clerk metadata so it's readable without a DB hit.
  if (clerkUser && clerkUser.publicMetadata?.role !== role) {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });
  }

  return row;
}

/** Redirects to sign-in when signed out; otherwise returns the DB user row. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Requires an admin (DM). Redirects players home, signed-out users to sign-in. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "admin") redirect("/");
  return user;
}

export { eq };
