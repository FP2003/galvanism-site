/*
 * Drizzle schema — Phase 1 core entities (info/roadmap.md §Phase 1).
 *
 * Clerk is the identity source of truth. `users.id` holds the Clerk user id, and
 * `role` is mirrored here from Clerk publicMetadata so admin gating can query the
 * DB directly without a Clerk round-trip. Player↔Character is 1:1.
 */
import {
  pgTable,
  pgEnum,
  text,
  integer,
  uuid,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRole = pgEnum("user_role", ["admin", "player"]);
export const characterStatus = pgEnum("character_status", [
  "active",
  "standby",
  "injured",
  "kia",
]);

// One row per Clerk account. Admins have no player/character rows.
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: userRole("role").notNull().default("player"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The in-game player profile: economic/account-level data. One per player user.
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name"), // operator's real name, distinct from the character callsign
  gold: integer("gold").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The character sheet. 1:1 with a player (unique playerId). Populated in Phase 2.
export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .unique()
      .references(() => players.id, { onDelete: "cascade" }),
    callsign: text("callsign").notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    rank: text("rank"),
    role: text("role"),
    status: characterStatus("status").notNull().default("standby"),
    // Player applications land as approved=false; the DM approves (→ true) or
    // denies (row deleted, player re-applies). Admin-created sheets are approved
    // on creation. Only approved characters appear on the roster/dashboard.
    approved: boolean("approved").notNull().default(true),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),

    hpCurrent: integer("hp_current").notNull().default(0),
    hpMax: integer("hp_max").notNull().default(0),
    energyCurrent: integer("energy_current").notNull().default(0),
    energyMax: integer("energy_max").notNull().default(0),
    energyRegen: integer("energy_regen").notNull().default(3),
    ammoCurrent: integer("ammo_current").notNull().default(0),
    ammoMax: integer("ammo_max").notNull().default(0),

    statTech: integer("stat_tech").notNull().default(0),
    statPrecision: integer("stat_precision").notNull().default(0),
    statStrength: integer("stat_strength").notNull().default(0),
    statImmunity: integer("stat_immunity").notNull().default(0),
    statResilience: integer("stat_resilience").notNull().default(0),
    statAgility: integer("stat_agility").notNull().default(0),

    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("characters_status_idx").on(t.status)],
);

export const usersRelations = relations(users, ({ one }) => ({
  player: one(players, { fields: [users.id], references: [players.userId] }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  user: one(users, { fields: [players.userId], references: [users.id] }),
  character: one(characters, {
    fields: [players.id],
    references: [characters.playerId],
  }),
  ledger: many(goldLedger),
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  player: one(players, {
    fields: [characters.playerId],
    references: [players.id],
  }),
}));

// Append-only record of every gold change (Phase 2 — the player's read-only gold
// ledger). `players.gold` stays the live balance; each adjustment writes one row
// here with the resulting `balanceAfter` for display. Phase 4's audit log builds
// on this table. Never updated in place — corrections are new (reversing) rows.
export const goldLedger = pgTable(
  "gold_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    refCode: text("ref_code"), // optional op/requisition reference (e.g. OP-0142)
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("gold_ledger_player_idx").on(t.playerId, t.createdAt)],
);

export const goldLedgerRelations = relations(goldLedger, ({ one }) => ({
  player: one(players, {
    fields: [goldLedger.playerId],
    references: [players.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type GoldLedgerEntry = typeof goldLedger.$inferSelect;
