import {
  Radar,
  Users,
  Crosshair,
  Factory,
  Vote,
  BookUser,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string; // absent = not yet built (phase-gated), rendered disabled
  phase?: string;
}

// Order mirrors the operational chain of command. Items without an href are
// forthcoming phases of info/roadmap.md and render disabled until built.
// Facilities absorbed Phase 4's Requisitions (info/roadmap.md §Phase 6) —
// there's no separate Requisitions entry anymore.
export const navItems: NavItem[] = [
  { label: "Command", icon: Radar, href: "/" },
  { label: "Roster", icon: Users, href: "/roster" },
  { label: "Missions", icon: Crosshair, href: "/missions" },
  { label: "Facilities", icon: Factory, href: "/facilities" },
  { label: "Ballots", icon: Vote, href: "/ballots" },
  { label: "Registry", icon: BookUser, phase: "Phase 8" },
];
