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
import { relations, sql } from "drizzle-orm";

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

// Item-card subcategory (only meaningful when category = "item"). rifle/pistol/
// melee are the "weapon" subcategories — they carry the weapon fields below and
// participate in the weapon-slot system; medical/grenade/other stay generic
// items using the plain equipped/inventory toggle.
export const itemSubcategory = pgEnum("item_subcategory", [
  "medical",
  "grenade",
  "rifle",
  "pistol",
  "melee",
  "other",
]);
// A two-handed weapon can only ever occupy the primary weapon slot.
export const weaponHandedness = pgEnum("weapon_handedness", [
  "one_handed",
  "two_handed",
]);
// Required for weapon subcategories, same as handedness (lib/weapons.ts).
export const weaponDamageType = pgEnum("weapon_damage_type", [
  "piercing",
  "bladed",
  "blunt",
  "electric",
  "power",
  "poison",
  "burn",
]);
// The three weapon-equip slots on a character (info/how_does_combat_accuracy_work.md).
export const weaponSlot = pgEnum("weapon_slot", [
  "primary",
  "secondary",
  "tertiary",
]);

// A shop listing is either admin-curated (permanent until removed by hand) or
// rotation-owned (auto-picked by restockShop, occupying one of the shop's
// numbered rotating slots). See shopListings below.
export const listingSource = pgEnum("listing_source", ["manual", "rotation"]);

// Phase 5 — Mission enums (info/roadmap.md §Phase 5). "failed" only happens via
// an Urgent deadline hitting zero without the mission completing first.
export const missionStatus = pgEnum("mission_status", [
  "available",
  "active",
  "complete",
  "failed",
]);
export const missionRisk = pgEnum("mission_risk", [
  "low",
  "moderate",
  "high",
  "severe",
]);
// A character's relationship to a mission: self-expressed interest, or a
// DM-confirmed assignment. See missionAssignments below.
export const missionAssignmentState = pgEnum("mission_assignment_state", [
  "interested",
  "assigned",
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
  credits: integer("credits").notNull().default(0),
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
  ledger: many(creditLedger),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  player: one(players, {
    fields: [characters.playerId],
    references: [players.id],
  }),
  xpLedger: many(xpLedger),
  missionAssignments: many(missionAssignments),
}));

// Append-only record of every credit change (Phase 2 — the player's read-only
// credit ledger). `players.credits` stays the live balance; each adjustment
// writes one row here with the resulting `balanceAfter` for display. Phase 4's
// audit log builds on this table. Never updated in place — corrections are new
// (reversing) rows.
export const creditLedger = pgTable(
  "credit_ledger",
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
  (t) => [index("credit_ledger_player_idx").on(t.playerId, t.createdAt)],
);

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  player: one(players, {
    fields: [creditLedger.playerId],
    references: [players.id],
  }),
}));

// Append-only record of every Total/Currency XP change on a character — currently
// admin grants only (positive delta); Phase 6 (Facilities) will add spend rows
// (negative delta) once players have somewhere to spend Currency XP. Never
// updated in place — corrections are new (reversing) rows, same convention as
// `creditLedger`.
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

  // Phase 4 — global sale price shown in shops. Null = not for sale; a card
  // can't be added to a shop listing until this is set (enforced in the
  // listing-add action, not a DB constraint, same convention as the item/
  // weapon fields below). Never shown to players outside the shop/
  // requisitions view — GameCard itself stays price-blind (lib/shops.ts).
  priceCredits: integer("price_credits"),

  // Optional flavor/feat-like text shown under the sheet's Effects section,
  // independent of any mechanical effects below.
  descriptiveText: text("descriptive_text"),

  // Item subcategory + weapon fields (Phase 4 prep). Set iff category = "item";
  // handedness/damage/range/ammoCount set iff subcategory is a weapon type
  // (rifle/pistol/melee). Legality is enforced in lib/weapons.ts + the create
  // action, not via a DB CHECK constraint. ammoCount is descriptive only (e.g.
  // magazine capacity) — it does not feed characters.ammoCurrent/ammoMax.
  subcategory: itemSubcategory("subcategory"),
  handedness: weaponHandedness("handedness"),
  damageType: weaponDamageType("damage_type"),
  damage: integer("damage"),
  range: integer("range"), // meters
  ammoCount: integer("ammo_count"),

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
    // Set iff this row is an equipped weapon (rifle/pistol/melee card). Written
    // together with `equipped` by setWeaponSlot; non-weapon rows never set it.
    weaponSlot: weaponSlot("weapon_slot"),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("character_cards_character_idx").on(t.characterId),
    uniqueIndex("character_cards_unique").on(t.characterId, t.cardId),
    // At most one weapon per character per slot.
    uniqueIndex("character_cards_weapon_slot_unique")
      .on(t.characterId, t.weaponSlot)
      .where(sql`${t.weaponSlot} is not null`),
  ],
);

export const cardsRelations = relations(cards, ({ many }) => ({
  assignments: many(characterCards),
  effects: many(cardEffects),
  listings: many(shopListings),
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

// ---------------------------------------------------------------------------
// Phase 4 — Shops (info/roadmap.md §Phase 4).
// ---------------------------------------------------------------------------

// A DM-run storefront. `rotatingSlotCount` is how many of its listings are
// auto-managed by restockShop (lib/shop-data.ts); an admin can also curate
// any number of permanent manual listings alongside those slots.
// `restockIntervalOps` is null for manual-restock-only shops; when set, the
// postMissionPayout admin action (app/admin/actions.ts) ticks
// `opsSinceRestock` and auto-restocks once it reaches the interval.
export const shops = pgTable("shops", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  isOpen: boolean("is_open").notNull().default(true),
  rotatingSlotCount: integer("rotating_slot_count").notNull().default(4),
  restockIntervalOps: integer("restock_interval_ops"),
  opsSinceRestock: integer("ops_since_restock").notNull().default(0),
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

// A card currently for sale in a shop. `source` distinguishes admin-curated
// listings (never touched by restockShop) from rotation-owned ones;
// `slotIndex` is set iff source = "rotation" and identifies which of the
// shop's rotatingSlotCount slots this row occupies — a restock replaces that
// slot's row in place rather than deleting + reinserting. Unique on
// (shopId, cardId): a shop never lists the same card twice regardless of
// source. Unique on (shopId, slotIndex) where not null: at most one row per
// rotation slot, same partial-unique-index shape as characterCards.weaponSlot.
export const shopListings = pgTable(
  "shop_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    source: listingSource("source").notNull().default("manual"),
    slotIndex: integer("slot_index"),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("shop_listings_shop_idx").on(t.shopId),
    uniqueIndex("shop_listings_shop_card_unique").on(t.shopId, t.cardId),
    uniqueIndex("shop_listings_shop_slot_unique")
      .on(t.shopId, t.slotIndex)
      .where(sql`${t.slotIndex} is not null`),
  ],
);

// The admin's weighted restock pool for a shop, e.g. category=tech level=1
// weight=80, category=tech level=2 weight=20 — see lib/shops.ts planRestock.
export const shopRestockRules = pgTable(
  "shop_restock_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    category: cardCategory("category").notNull(),
    level: integer("level").notNull(),
    weight: integer("weight").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("shop_restock_rules_shop_idx").on(t.shopId)],
);

export const shopsRelations = relations(shops, ({ many }) => ({
  listings: many(shopListings),
  restockRules: many(shopRestockRules),
}));

export const shopListingsRelations = relations(shopListings, ({ one }) => ({
  shop: one(shops, { fields: [shopListings.shopId], references: [shops.id] }),
  card: one(cards, { fields: [shopListings.cardId], references: [cards.id] }),
}));

export const shopRestockRulesRelations = relations(shopRestockRules, ({ one }) => ({
  shop: one(shops, {
    fields: [shopRestockRules.shopId],
    references: [shops.id],
  }),
}));

// ---------------------------------------------------------------------------
// Phase 5 — Missions (info/roadmap.md §Phase 5).
// ---------------------------------------------------------------------------

// A DM-posted mission. `payoutCredits` and `payoutXp` are each a total pot,
// split evenly across assigned characters on completion (see lib/missions.ts
// splitPayoutEvenly + completeMission) — credits land on the player, XP on
// the character, granted the same way as an admin's manual applyXpGrant
// (raises both totalXp and currencyXp). `sector` is a free-text location
// label — real map zones/pins are deferred past this phase. `urgentDeadline`
// is set iff `urgent = true`: ops (missions) remaining before this mission
// auto-fails, decremented by 1 each time *any other* mission completes (see
// completeMission's best-effort tick, mirroring the shop restock tick's
// non-transactional convention) — the completing mission itself is excluded,
// so finishing exactly on a deadline of 1 succeeds rather than failing.
export const missions = pgTable(
  "missions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    sector: text("sector"),
    briefing: text("briefing"), // markdown
    payoutCredits: integer("payout_credits").notNull().default(0),
    payoutXp: integer("payout_xp").notNull().default(0),
    risk: missionRisk("risk").notNull().default("low"),
    status: missionStatus("status").notNull().default("available"),
    urgent: boolean("urgent").notNull().default(false),
    urgentDeadline: integer("urgent_deadline"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("missions_status_idx").on(t.status)],
);

// A character's interest in or assignment to a mission. Unique per
// (mission, character) — re-expressing interest is a no-op, not a second row.
// Modeled directly on characterCards above.
export const missionAssignments = pgTable(
  "mission_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    state: missionAssignmentState("state").notNull().default("interested"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mission_assignments_mission_idx").on(t.missionId),
    index("mission_assignments_character_idx").on(t.characterId),
    uniqueIndex("mission_assignments_unique").on(t.missionId, t.characterId),
  ],
);

export const missionsRelations = relations(missions, ({ many }) => ({
  assignments: many(missionAssignments),
}));

export const missionAssignmentsRelations = relations(
  missionAssignments,
  ({ one }) => ({
    mission: one(missions, {
      fields: [missionAssignments.missionId],
      references: [missions.id],
    }),
    character: one(characters, {
      fields: [missionAssignments.characterId],
      references: [characters.id],
    }),
  }),
);

export type User = typeof users.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type XpLedgerEntry = typeof xpLedger.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardEffect = typeof cardEffects.$inferSelect;
export type NewCardEffect = typeof cardEffects.$inferInsert;
export type CardWithEffects = Card & { effects: CardEffect[] };
export type CharacterCard = typeof characterCards.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
export type ShopListing = typeof shopListings.$inferSelect;
export type NewShopListing = typeof shopListings.$inferInsert;
export type ShopRestockRule = typeof shopRestockRules.$inferSelect;
export type NewShopRestockRule = typeof shopRestockRules.$inferInsert;
export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;
export type MissionAssignment = typeof missionAssignments.$inferSelect;
export type NewMissionAssignment = typeof missionAssignments.$inferInsert;
