/*
 * Phase 0 mock data. No database yet — these fixtures let the Ops Terminal and
 * Case File templates render real-shaped content. Replaced by Postgres in Phase 1.
 */

export type OperatorStatus = "active" | "standby" | "injured" | "kia";

export interface Operator {
  callsign: string;
  slug: string;
  name: string;
  rank: string;
  role: string;
  status: OperatorStatus;
  hp: { current: number; max: number };
  energy: { current: number; max: number };
  ammo: { current: number; max: number };
  stats: {
    tech: number;
    precision: number;
    strength: number;
    immunity: number;
    resilience: number;
    agility: number;
  };
  credits: number;
  bio: string;
  ledger: { entry: string; delta: number; op: string }[];
}

export const operators: Operator[] = [
  {
    callsign: "HALYARD",
    slug: "halyard",
    name: "M. Okonkwo",
    rank: "Custodian, Grade II",
    role: "Breacher",
    status: "active",
    hp: { current: 22, max: 28 },
    energy: { current: 5, max: 6 },
    ammo: { current: 48, max: 60 },
    stats: { tech: 2, precision: 4, strength: 5, immunity: 100, resilience: 6, agility: 3 },
    credits: 1240,
    bio: "Transferred into Regiment Foxtrot after two tours clearing the Embarcadero contested zone. Prefers close-quarters resolution. Flagged twice for exceeding force authorization; retained for effectiveness.",
    ledger: [
      { entry: "Operation payout — Sublevel sweep", delta: 400, op: "OP-0142" },
      { entry: "Armory — 9mm resupply", delta: -60, op: "REQ-0311" },
      { entry: "Upgrade Center — mod install", delta: -180, op: "REQ-0309" },
    ],
  },
  {
    callsign: "VESPER",
    slug: "vesper",
    name: "L. Sato",
    rank: "Custodian, Grade I",
    role: "Tech Specialist",
    status: "active",
    hp: { current: 16, max: 18 },
    energy: { current: 7, max: 8 },
    ammo: { current: 30, max: 40 },
    stats: { tech: 6, precision: 3, strength: 1, immunity: 100, resilience: 3, agility: 4 },
    credits: 890,
    bio: "Recruited out of the Sector 9 conscription lottery. Maintains the regiment's intrusion and diagnostics kit. Quiet, meticulous, distrusted by command for asking where the funding comes from.",
    ledger: [
      { entry: "Operation payout — Relay tap", delta: 320, op: "OP-0139" },
      { entry: "Shop — Intrusion cell x2", delta: -140, op: "REQ-0304" },
    ],
  },
  {
    callsign: "DRAYLINE",
    slug: "drayline",
    name: "K. Alvarez",
    rank: "Custodian, Grade II",
    role: "Marksman",
    status: "injured",
    hp: { current: 6, max: 24 },
    energy: { current: 3, max: 6 },
    ammo: { current: 12, max: 45 },
    stats: { tech: 3, precision: 6, strength: 3, immunity: 100, resilience: 4, agility: 5 },
    credits: 1610,
    bio: "Longest-serving member of Foxtrot. Took shrapnel during the Pier 70 extraction and is on medical hold pending Medical Center capacity.",
    ledger: [
      { entry: "Operation payout — Overwatch, Pier 70", delta: 520, op: "OP-0141" },
      { entry: "Medical Center — trauma stabilization", delta: -300, op: "REQ-0312" },
    ],
  },
  {
    callsign: "MERIDIAN",
    slug: "meridian",
    name: "T. Bădescu",
    rank: "Custodian, Grade I",
    role: "Support",
    status: "standby",
    hp: { current: 20, max: 20 },
    energy: { current: 5, max: 5 },
    ammo: { current: 40, max: 40 },
    stats: { tech: 4, precision: 2, strength: 2, immunity: 100, resilience: 5, agility: 3 },
    credits: 430,
    bio: "Newest transfer, still completing orientation. Assigned to the station rebuild detail until cleared for field operations.",
    ledger: [{ entry: "Enlistment stipend", delta: 250, op: "ADM-0007" }],
  },
];

export type MissionStatus = "available" | "active" | "complete" | "failed";

// Field names match the real `missions` DB row (src/lib/schema.ts) so this
// fixture and a live query satisfy the same DashboardMission shape without a
// mapping step — same convention as the `operators` fixtures above and
// CharacterView.
export interface Mission {
  id: string;
  title: string;
  sector: string | null;
  payoutCredits: number;
  payoutXp: number;
  risk: "low" | "moderate" | "high" | "severe";
  status: MissionStatus;
  urgent: boolean;
  urgentDeadline: number | null; // ops remaining before failure, if urgent
}

export const missions: Mission[] = [
  {
    id: "OP-0148",
    title: "Sublevel Purge — Tenderloin Access",
    sector: "Sector 4",
    payoutCredits: 600,
    payoutXp: 60,
    risk: "high",
    status: "active",
    urgent: true,
    urgentDeadline: 2,
  },
  {
    id: "OP-0150",
    title: "Relay Reclamation",
    sector: "Sector 9",
    payoutCredits: 340,
    payoutXp: 30,
    risk: "moderate",
    status: "available",
    urgent: false,
    urgentDeadline: null,
  },
  {
    id: "OP-0151",
    title: "Checkpoint Reinforcement",
    sector: "Sector 2",
    payoutCredits: 180,
    payoutXp: 15,
    risk: "low",
    status: "available",
    urgent: false,
    urgentDeadline: null,
  },
];

export interface FacilityProcess {
  facility: string;
  label: string;
}

export const facilityProcesses: FacilityProcess[] = [
  { facility: "Armory", label: "Ammo Resupply: 2 days" },
  { facility: "Intel Center", label: "Sensor Grid Upgrade: 1 day" },
  { facility: "Medical Center", label: "Trauma Bay Restock: 4 days" },
];

export interface Ballot {
  code: string;
  title: string;
  closes: string;
  options: { label: string; votes: number }[];
}

export const openBallot: Ballot = {
  code: "BAL-0021",
  title: "Next shared upgrade for the station",
  closes: "Closes end of next session",
  options: [
    { label: "Barracks — 4th bunk", votes: 2 },
    { label: "Upgrade Center — tier II bench", votes: 1 },
    { label: "Armory — heavy weapons locker", votes: 0 },
  ],
};

export const regiment = {
  designation: "REGIMENT FOXTROT",
  sector: "SUPERCITY S.F.",
  station: "Precinct 19 (derelict — rebuild in progress)",
  operator: { callsign: "ACTUAL", clearance: "FOXTROT" },
};
