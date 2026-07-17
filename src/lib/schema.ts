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
  type AnyPgColumn,
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
// firearm_mod/melee_mod are the weapon-customisation categories (Components,
// info/galvanism_prep.md) — distinct from "mod" (body mods/Modifications).
// They install onto a rifle/pistol or melee weapon's character_cards row
// rather than sitting in the character's plain equipped/inventory toggle.
export const cardCategory = pgEnum("card_category", [
  "combat",
  "defense",
  "mod",
  "movement",
  "resilience",
  "tech",
  "ability",
  "item",
  "firearm_mod",
  "melee_mod",
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

// A facility listing is either admin-curated (permanent until removed by hand)
// or rotation-owned (auto-picked by restockFacility, occupying one of the
// facility's numbered rotating slots). See facilityListings below.
export const listingSource = pgEnum("listing_source", ["manual", "rotation"]);

// Phase 6 — Facility kind (info/roadmap.md §Phase 6). "station" facilities are
// the named, admin-leveled services (Gym, Armory, ...); "field" facilities are
// small flavor shops (food, arcade, ...) that never level up.
export const facilityKind = pgEnum("facility_kind", ["station", "field"]);

// Phase 6 Step 2 — an XP offering is a permanent stat bump (targets one of
// the 6 stat columns), a one-off refill of a current resource (targets
// hpCurrent/energyCurrent/ammoCurrent, clamped to its — possibly card-boosted
// — max), or purely descriptive (charges XP but touches no character column —
// the DM manually honors the effect, e.g. a perk-funded Tech Slot Upgrade
// letting a player buy extra equip slots). See lib/facilities.ts
// offeringTargetsFor.
export const xpOfferingType = pgEnum("xp_offering_type", [
  "stat_bump",
  "resource_refill",
  "descriptive",
]);

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

// Phase 7 — Ballot status (info/roadmap.md §Phase 7). "closed" happens either
// by an admin's manual close or an ops deadline hitting zero — both are purely
// informational (they just lock the tally), unlike a mission's "failed".
export const ballotStatus = pgEnum("ballot_status", ["open", "closed"]);

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
    // Freeform temporary HP buffer. Fully player-controlled — no ceiling, no
    // automatic interaction with hpCurrent (there's no "apply damage" flow to
    // hook into; players already edit hpCurrent directly).
    hpTemp: integer("hp_temp").notNull().default(0),
    energyCurrent: integer("energy_current").notNull().default(0),
    energyMax: integer("energy_max").notNull().default(0),
    energyRegen: integer("energy_regen").notNull().default(3),
    ammoCurrent: integer("ammo_current").notNull().default(0),
    ammoMax: integer("ammo_max").notNull().default(0),
    // Effective movement = movementBase + METERS_PER_EP * movementEpSpent
    // (lib/game-rules.ts, lib/ledger.ts movementMeters) — computed, never
    // stored as its own final number. movementBase is the DM-set free-
    // movement floor (per-character, like hpMax); movementEpSpent is how
    // much Energy is currently committed to extra movement, distinct from
    // Energy spent on other actions (which just lowers energyCurrent).
    movementBase: integer("movement_base").notNull().default(6),
    movementEpSpent: integer("movement_ep_spent").notNull().default(0),

    statTech: integer("stat_tech").notNull().default(0),
    statPrecision: integer("stat_precision").notNull().default(0),
    statStrength: integer("stat_strength").notNull().default(0),
    statImmunity: integer("stat_immunity").notNull().default(0),
    statResilience: integer("stat_resilience").notNull().default(0),
    statAgility: integer("stat_agility").notNull().default(0),

    bio: text("bio"),
    // Spinning HeroForge mini GIF shown on the case file + roster, stored in
    // Vercel Blob — a single portrait per character, not a gallery.
    portraitUrl: text("portrait_url"),
    // Canonical YouTube watch URL (https://www.youtube.com/watch?v=<id>) for the
    // case-file theme-song player — normalized/validated in lib/youtube.ts.
    themeSongUrl: text("theme_song_url"),
    // Video title captured best-effort from YouTube oEmbed at save time; null if
    // the lookup failed. Display-only.
    themeSongTitle: text("theme_song_title"),
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
  perkContributions: many(facilityPerkContributions),
  purchasedFacilityListings: many(facilityListings),
  ballotVotes: many(ballotVotes),
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

  // Phase 6 — global sale price shown at facilities. Null = not for sale; a
  // card can't be added to a facility listing until this is set (enforced in
  // the listing-add action, not a DB constraint, same convention as the item/
  // weapon fields below). Never shown to players outside the facility view —
  // GameCard itself stays price-blind (lib/facilities.ts).
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

  // Weapon customisation. modSlots is set iff subcategory is a weapon type
  // (rifle/pistol/melee) — how many mods that weapon can carry. The mod*
  // fields are set iff category is firearm_mod/melee_mod — the structured
  // delta a mod applies to its host weapon's displayed stat line once
  // installed (lib/weapons.ts computeWeaponProfile); everything else about a
  // mod (EP penalties, ACC, SHOCK, ...) is descriptive-only via
  // descriptiveText above. Legality enforced in lib/weapons.ts + the create
  // action, not via a DB CHECK constraint, same convention as the item/
  // weapon fields.
  modSlots: integer("mod_slots"),
  modDamageDelta: integer("mod_damage_delta"),
  modRangeDelta: integer("mod_range_delta"),
  modAddedDamageType: weaponDamageType("mod_added_damage_type"),

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
    // Set iff this row is a firearm_mod/melee_mod card that's been installed
    // on one of this same character's weapon rows — points at the host's
    // character_cards.id. Installation is permanent for players (only an
    // admin can detach, via detachMod); `set null` means unassigning or
    // deleting the host weapon automatically returns its mods to uninstalled
    // inventory with no extra cleanup code.
    installedOnCharacterCardId: uuid("installed_on_character_card_id").references(
      (): AnyPgColumn => characterCards.id,
      { onDelete: "set null" },
    ),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("character_cards_character_idx").on(t.characterId),
    index("character_cards_installed_on_idx").on(t.installedOnCharacterCardId),
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
  listings: many(facilityListings),
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
// Phase 6 — Facilities (info/roadmap.md §Phase 6). Absorbs Phase 4's shops —
// a facility IS a shop (plus, for "station" kind, a level and, in later
// migrations, XP-training/perk/ongoing-process catalogs), not a wrapper
// around a separate shop entity.
// ---------------------------------------------------------------------------

// A DM-run facility. `rotatingSlotCount` is how many of its listings are
// auto-managed by restockFacility (lib/facility-data.ts); an admin can also
// curate any number of permanent manual listings alongside those slots.
// `restockIntervalOps` is null for manual-restock-only facilities; when set,
// the postMissionPayout admin action (app/admin/actions.ts) ticks
// `opsSinceRestock` and auto-restocks once it reaches the interval.
// `level` is admin-set by hand (no automatic leveling) and caps which
// `cards.level` this facility can list/roll — see lib/facilities.ts
// isCardLevelUnlocked. `kind` distinguishes named Station facilities (leveled,
// specialized) from small Field shops (food/arcade-type, never leveled).
export const facilities = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  isOpen: boolean("is_open").notNull().default(true),
  level: integer("level").notNull().default(1),
  kind: facilityKind("kind").notNull().default("station"),
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

// A card currently for sale at a facility. `source` distinguishes admin-
// curated listings (never touched by restockFacility) from rotation-owned
// ones; `slotIndex` is set iff source = "rotation" and identifies which of
// the facility's rotatingSlotCount slots this row occupies — a restock
// replaces that slot's row in place rather than deleting + reinserting.
// `purchasedByCharacterId` claims one particular appearance of the card in
// stock. The buyer sees it as Owned and other characters see it as Bought. A
// rotation clears the claim, making the newly rolled appearance available
// again (including when the same card is rolled twice in a row).
// Unique on (facilityId, cardId): a facility never lists the same card twice
// regardless of source. Unique on (facilityId, slotIndex) where not null: at
// most one row per rotation slot, same partial-unique-index shape as
// characterCards.weaponSlot.
export const facilityListings = pgTable(
  "facility_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    purchasedByCharacterId: uuid("purchased_by_character_id").references(
      () => characters.id,
      { onDelete: "set null" },
    ),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    source: listingSource("source").notNull().default("manual"),
    slotIndex: integer("slot_index"),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("facility_listings_facility_idx").on(t.facilityId),
    index("facility_listings_purchased_by_idx").on(t.purchasedByCharacterId),
    uniqueIndex("facility_listings_facility_card_unique").on(t.facilityId, t.cardId),
    uniqueIndex("facility_listings_facility_slot_unique")
      .on(t.facilityId, t.slotIndex)
      .where(sql`${t.slotIndex} is not null`),
  ],
);

// The admin's weighted restock pool for a facility, e.g. category=tech
// level=1 weight=80, category=tech level=2 weight=20 — see lib/facilities.ts
// planRestock. `level` must not exceed the parent facility's own `level`
// (enforced in the addRestockRule action, not a DB constraint). `subcategory`
// is set iff category = "item" (same convention as cards.subcategory above) —
// null means the rule draws from every item subcategory.
export const facilityRestockRules = pgTable(
  "facility_restock_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    category: cardCategory("category").notNull(),
    subcategory: itemSubcategory("subcategory"),
    level: integer("level").notNull(),
    weight: integer("weight").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("facility_restock_rules_facility_idx").on(t.facilityId)],
);

// A facility's XP-training catalog entry (Phase 6 Step 2). `targetKey` matches
// a `characters` DB column, same convention as `cardEffects.effectTarget`
// (see offeringTargetsFor in lib/facilities.ts) — a stat key for a stat_bump,
// or a *Current resource key for a resource_refill. `minLevel` gates player
// visibility/purchase against the facility's own level (facility.level >=
// minLevel), independent of when the row was created — an admin can pre-stage
// a higher-tier offering before the facility is leveled up to unlock it.
// `active` retires an offering without deleting it, keeping historical
// xp_ledger/credit_ledger rows (which store no FK back here) meaningful.
// `cost` is charged in Currency XP for a stat_bump but Credits for a
// resource_refill — the currency is derived from `offeringType`, not chosen
// per row (see offeringCostCurrency in lib/facilities.ts): permanent training
// costs XP, a patch-up at Medical Bay costs Credits like any other purchase.
export const facilityXpOfferings = pgTable(
  "facility_xp_offerings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    offeringType: xpOfferingType("offering_type").notNull(),
    targetKey: text("target_key").notNull(),
    amount: integer("amount").notNull(),
    cost: integer("cost").notNull(),
    minLevel: integer("min_level").notNull().default(1),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("facility_xp_offerings_facility_idx").on(t.facilityId)],
);

// A facility's descriptive-perk catalog entry (Phase 6 Step 3), e.g. the
// Communication Center's "Called Extraction time reduction." Purely
// descriptive — the DM manually honors the effect at the table, no
// mission-engine mechanic reads this row. `minLevel`/`active` follow the same
// gating convention as facilityXpOfferings.
// Perks are crowd-funded team-wide upgrades (reworked from a one-time
// per-character purchase): `priceCredits` is the funding target, players
// chip in any amount via facilityPerkContributions, and `fundedAt` is set
// once the pooled total reaches the price — at which point the perk benefits
// the whole team, not just whoever tipped it over. A facility auto-levels
// once every currently-unlocked perk (active, minLevel <= facility.level) is
// funded — see contributeToPerk in app/facilities/[id]/purchase-actions.ts.
export const facilityPerks = pgTable(
  "facility_perks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCredits: integer("price_credits").notNull(),
    minLevel: integer("min_level").notNull().default(1),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("facility_perks_facility_idx").on(t.facilityId)],
);

// One row per player contribution toward funding a perk (Credits only).
// Never deleted or updated outside an admin correction — multiple characters
// (or the same one, more than once) can each chip in, same append-only
// convention as creditLedger/xpLedger. The pooled sum for a perk is compared
// against `facilityPerks.priceCredits` to decide when it's funded.
export const facilityPerkContributions = pgTable(
  "facility_perk_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    perkId: uuid("perk_id")
      .notNull()
      .references(() => facilityPerks.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("facility_perk_contributions_perk_idx").on(t.perkId)],
);

// A DM-authored free-text status line for one facility (Phase 6 Step 4), e.g.
// "Ammo Resupply: 2 days" — `label` is the whole hand-typed string, there's no
// structured countdown or automatic timer. "Clearing" one toggles `resolved`
// rather than deleting the row, so the dashboard/admin view keeps a real
// history instead of losing completed processes.
export const facilityOngoingEntries = pgTable(
  "facility_ongoing_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("facility_ongoing_entries_facility_idx").on(t.facilityId)],
);

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  listings: many(facilityListings),
  restockRules: many(facilityRestockRules),
  xpOfferings: many(facilityXpOfferings),
  perks: many(facilityPerks),
  ongoingEntries: many(facilityOngoingEntries),
}));

export const facilityXpOfferingsRelations = relations(facilityXpOfferings, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityXpOfferings.facilityId],
    references: [facilities.id],
  }),
}));

export const facilityPerksRelations = relations(facilityPerks, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [facilityPerks.facilityId],
    references: [facilities.id],
  }),
  contributions: many(facilityPerkContributions),
}));

export const facilityPerkContributionsRelations = relations(
  facilityPerkContributions,
  ({ one }) => ({
    perk: one(facilityPerks, {
      fields: [facilityPerkContributions.perkId],
      references: [facilityPerks.id],
    }),
    character: one(characters, {
      fields: [facilityPerkContributions.characterId],
      references: [characters.id],
    }),
  }),
);

export const facilityOngoingEntriesRelations = relations(facilityOngoingEntries, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityOngoingEntries.facilityId],
    references: [facilities.id],
  }),
}));

export const facilityListingsRelations = relations(facilityListings, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityListings.facilityId],
    references: [facilities.id],
  }),
  card: one(cards, { fields: [facilityListings.cardId], references: [cards.id] }),
  purchasedBy: one(characters, {
    fields: [facilityListings.purchasedByCharacterId],
    references: [characters.id],
  }),
}));

export const facilityRestockRulesRelations = relations(facilityRestockRules, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityRestockRules.facilityId],
    references: [facilities.id],
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

// A photo attached to a mission's briefing (case-file gallery). `url` is the
// full public Vercel Blob URL — rendered directly and passed to del() on
// cleanup, so no separate pathname/contentType/size columns are needed.
export const missionAttachments = pgTable(
  "mission_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mission_attachments_mission_idx").on(t.missionId, t.createdAt)],
);

export const missionsRelations = relations(missions, ({ many }) => ({
  assignments: many(missionAssignments),
  attachments: many(missionAttachments),
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

export const missionAttachmentsRelations = relations(
  missionAttachments,
  ({ one }) => ({
    mission: one(missions, {
      fields: [missionAttachments.missionId],
      references: [missions.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Phase 7 — Ballots (info/roadmap.md §Phase 7).
// ---------------------------------------------------------------------------

// A DM-posted shared-upgrade vote. `opsDeadline` is set iff there's a time
// limit: ops (missions) remaining before this ballot auto-closes, decremented
// by 1 each time *any* mission completes (see completeMission's best-effort
// tick in app/admin/mission-actions.ts, mirroring the Urgent-mission tick's
// non-transactional convention — but every open ballot ticks, there's no
// "exclude the one that just happened" exclusion since a ballot is never
// itself the thing that completes). Closing — manual or via deadline — is
// purely informational: it locks the tally for display, nothing else. Null
// opsDeadline = no time limit, closes only by an admin's manual action.
export const ballots = pgTable(
  "ballots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    status: ballotStatus("status").notNull().default("open"),
    opsDeadline: integer("ops_deadline"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
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
  (t) => [index("ballots_status_idx").on(t.status)],
);

// One option on a ballot. Not editable once votes exist (see
// app/admin/ballot-actions.ts) — delete-and-recreate the ballot is the escape
// hatch for a typo'd option set.
export const ballotOptions = pgTable(
  "ballot_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ballotId: uuid("ballot_id")
      .notNull()
      .references(() => ballots.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ballot_options_ballot_idx").on(t.ballotId)],
);

// A character's current pick on a ballot. Single-choice and changeable: one
// row per (ballot, character) — unique on that pair, not on (option,
// character) — so changing a vote is an UPDATE of this row's optionId (upsert
// via onConflictDoUpdate, same idiom as mission-actions.ts's
// assignCharacterDirect), never a second row. `ballotId` is denormalized
// directly onto the row (rather than only reachable via optionId) for the
// same reason missionAssignments stores missionId directly.
export const ballotVotes = pgTable(
  "ballot_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ballotId: uuid("ballot_id")
      .notNull()
      .references(() => ballots.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => ballotOptions.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ballot_votes_ballot_idx").on(t.ballotId),
    index("ballot_votes_option_idx").on(t.optionId),
    uniqueIndex("ballot_votes_unique").on(t.ballotId, t.characterId),
  ],
);

export const ballotsRelations = relations(ballots, ({ many }) => ({
  options: many(ballotOptions),
  votes: many(ballotVotes),
}));

// Phase 8 — Registry (info/roadmap.md §Phase 8). A DM-authored lore glossary
// (NPCs, locations, factions, items, events) that other free-text fields
// (mission briefings, character bios, card text) can link to. `visibility`
// gates whether the entry is browsable/linkable by players at all;
// `gmNotes` is a second, always-admin-only field on every entry regardless of
// `visibility` — see lib/registry-data.ts for why the player-facing queries
// are written as a separate, narrower function rather than one shared query
// with component-level filtering (the pattern facilities/ballots use): those
// rows have nothing actually secret on them, this one does.
export const registryEntryType = pgEnum("registry_entry_type", [
  "npc",
  "location",
  "faction",
  "item",
  "event",
]);
export const registryVisibility = pgEnum("registry_visibility", [
  "public",
  "hidden",
]);

export const registryEntries = pgTable(
  "registry_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    type: registryEntryType("type").notNull(),
    visibility: registryVisibility("visibility").notNull().default("public"),
    description: text("description"), // markdown, player-visible when public
    gmNotes: text("gm_notes"), // markdown, admin-only, always
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
  (t) => [
    index("registry_entries_type_idx").on(t.type),
    index("registry_entries_visibility_idx").on(t.visibility),
  ],
);

export const ballotOptionsRelations = relations(
  ballotOptions,
  ({ one, many }) => ({
    ballot: one(ballots, {
      fields: [ballotOptions.ballotId],
      references: [ballots.id],
    }),
    votes: many(ballotVotes),
  }),
);

export const ballotVotesRelations = relations(ballotVotes, ({ one }) => ({
  ballot: one(ballots, {
    fields: [ballotVotes.ballotId],
    references: [ballots.id],
  }),
  option: one(ballotOptions, {
    fields: [ballotVotes.optionId],
    references: [ballotOptions.id],
  }),
  character: one(characters, {
    fields: [ballotVotes.characterId],
    references: [characters.id],
  }),
}));

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
export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
export type FacilityListing = typeof facilityListings.$inferSelect;
export type NewFacilityListing = typeof facilityListings.$inferInsert;
export type FacilityRestockRule = typeof facilityRestockRules.$inferSelect;
export type NewFacilityRestockRule = typeof facilityRestockRules.$inferInsert;
export type FacilityXpOffering = typeof facilityXpOfferings.$inferSelect;
export type NewFacilityXpOffering = typeof facilityXpOfferings.$inferInsert;
export type FacilityPerk = typeof facilityPerks.$inferSelect;
export type NewFacilityPerk = typeof facilityPerks.$inferInsert;
export type FacilityPerkContribution = typeof facilityPerkContributions.$inferSelect;
export type NewFacilityPerkContribution = typeof facilityPerkContributions.$inferInsert;
export type FacilityOngoingEntry = typeof facilityOngoingEntries.$inferSelect;
export type NewFacilityOngoingEntry = typeof facilityOngoingEntries.$inferInsert;
export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;
export type MissionAssignment = typeof missionAssignments.$inferSelect;
export type NewMissionAssignment = typeof missionAssignments.$inferInsert;
export type MissionAttachment = typeof missionAttachments.$inferSelect;
export type NewMissionAttachment = typeof missionAttachments.$inferInsert;
export type Ballot = typeof ballots.$inferSelect;
export type NewBallot = typeof ballots.$inferInsert;
export type BallotOption = typeof ballotOptions.$inferSelect;
export type NewBallotOption = typeof ballotOptions.$inferInsert;
export type BallotVote = typeof ballotVotes.$inferSelect;
export type NewBallotVote = typeof ballotVotes.$inferInsert;
export type RegistryEntry = typeof registryEntries.$inferSelect;
export type NewRegistryEntry = typeof registryEntries.$inferInsert;
