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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRole = pgEnum("user_role", ["admin", "player"]);
export const characterStatus = pgEnum("character_status", [
  "active",
  "standby",
  "injured",
  "kia",
]);

// Phase 3 — Card system enums (info/roadmap.md §Phase 3, info/card_system.md).
// The six colored categories match the reference designs' one-color-per-category
// scheme; "ability"/"item" are the generic (neutral) cards.
export const cardCategory = pgEnum("card_category", [
  "combat",
  "defense",
  "mod",
  "movement",
  "resilience",
  "tech",
  "ability",
  "item",
]);
// The ACTIVE/PASSIVE tag on an effect (per-effect, not per-card — a card can
// carry both at once).
export const cardActivation = pgEnum("card_activation", ["active", "passive"]);
// Structured mechanical effect types. Deliberately narrow for Phase 3 (targets
// that exist today); "grant_item" / "unlock_ability" join in Phase 4+.
export const cardEffectType = pgEnum("card_effect_type", [
  "stat_modifier",
  "resource_modifier",
]);
// When a mechanical effect applies. on_equip + passive contribute to the sheet's
// effective stats while equipped; on_use is momentary (adjudicated at the table).
export const cardTrigger = pgEnum("card_trigger", [
  "on_equip",
  "on_use",
  "passive",
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
  name: text("name"), // operator's gaming alias (e.g. "EpicGamerName"), distinct from the character callsign
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
    // Total XP is cumulative and admin-granted only (never decreases), and is
    // never shown to players. Currency XP is the spendable balance shown to
    // players — Phase 6 (Facilities) is where they'll actually spend it; every
    // grant raises both by the same amount.
    totalXp: integer("total_xp").notNull().default(0),
    currencyXp: integer("currency_xp").notNull().default(0),

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

export const charactersRelations = relations(characters, ({ one, many }) => ({
  player: one(players, {
    fields: [characters.playerId],
    references: [players.id],
  }),
  xpLedger: many(xpLedger),
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

// Append-only record of every Total/Currency XP change on a character — currently
// admin grants only (positive delta); Phase 6 (Facilities) will add spend rows
// (negative delta) once players have somewhere to spend Currency XP. Never
// updated in place — corrections are new (reversing) rows, same convention as
// `goldLedger`.
export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    delta: integer("delta").notNull(),
    totalXpAfter: integer("total_xp_after").notNull(),
    currencyXpAfter: integer("currency_xp_after").notNull(),
    refCode: text("ref_code"), // optional reference — reserved for a future mission code
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("xp_ledger_character_idx").on(t.characterId, t.createdAt)],
);

export const xpLedgerRelations = relations(xpLedger, ({ one }) => ({
  character: one(characters, {
    fields: [xpLedger.characterId],
    references: [characters.id],
  }),
}));

// ---------------------------------------------------------------------------
// Phase 3 — Cards (info/roadmap.md §Phase 3).
// ---------------------------------------------------------------------------

// The card library: definitions the DM authors once and assigns to any number of
// operators. A card can carry any number of structured mechanical effects (see
// `cardEffects` below) plus an optional free-text `descriptiveText` flavor
// blurb — the two aren't mutually exclusive. Mechanical stat/resource effects
// are NOT written into character columns — they're computed on top of the live
// base stats at read time (see lib/cards.ts computeEffectiveStats), so
// unequipping is lossless and level-up base bumps stay independent.
export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: cardCategory("category").notNull(),
  title: text("title").notNull(),
  // Card-face body copy (the DESCRIPTION area). Distinct from `descriptiveText`,
  // which is the Effects-section flavor text.
  description: text("description"),
  level: integer("level").notNull().default(1), // Roman-numeral pip
  colorOverride: text("color_override"), // hex for one-off custom cards; null = category preset

  // Optional flavor/feat-like text shown under the sheet's Effects section,
  // independent of any mechanical effects below.
  descriptiveText: text("descriptive_text"),

  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A single structured mechanical effect on a card. A card can carry several —
// e.g. a passive stat bump and an active on-use resource cost at once — each
// with its own ACTIVE/PASSIVE tag, type, target, amount, and trigger.
export const cardEffects = pgTable(
  "card_effects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    activation: cardActivation("activation").notNull().default("passive"),
    effectType: cardEffectType("effect_type").notNull(),
    effectTarget: text("effect_target").notNull(), // stat key (statTech…) or resource key (hpMax/energyMax/ammoMax)
    effectAmount: integer("effect_amount").notNull(),
    trigger: cardTrigger("trigger").notNull().default("passive"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("card_effects_card_idx").on(t.cardId)],
);

// A character's ownership of a card (inventory), plus whether it's equipped. Only
// equipped cards contribute to effective stats / show in the Loadout. Unique per
// (character, card) — a duplicate assignment is a no-op, not a second copy.
export const characterCards = pgTable(
  "character_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    equipped: boolean("equipped").notNull().default(false),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("character_cards_character_idx").on(t.characterId),
    uniqueIndex("character_cards_unique").on(t.characterId, t.cardId),
  ],
);

export const cardsRelations = relations(cards, ({ many }) => ({
  assignments: many(characterCards),
  effects: many(cardEffects),
}));

export const cardEffectsRelations = relations(cardEffects, ({ one }) => ({
  card: one(cards, {
    fields: [cardEffects.cardId],
    references: [cards.id],
  }),
}));

export const characterCardsRelations = relations(characterCards, ({ one }) => ({
  character: one(characters, {
    fields: [characterCards.characterId],
    references: [characters.id],
  }),
  card: one(cards, {
    fields: [characterCards.cardId],
    references: [cards.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type GoldLedgerEntry = typeof goldLedger.$inferSelect;
export type XpLedgerEntry = typeof xpLedger.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardEffect = typeof cardEffects.$inferSelect;
export type NewCardEffect = typeof cardEffects.$inferInsert;
export type CardWithEffects = Card & { effects: CardEffect[] };
export type CharacterCard = typeof characterCards.$inferSelect;
