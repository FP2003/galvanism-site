import {
  Radar,
  Users,
  Crosshair,
  Factory,
  Package,
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
export const navItems: NavItem[] = [
  { label: "Command", icon: Radar, href: "/" },
  { label: "Roster", icon: Users, href: "/roster" },
  { label: "Missions", icon: Crosshair, phase: "Phase 5" },
  { label: "Facilities", icon: Factory, phase: "Phase 6" },
  { label: "Requisitions", icon: Package, href: "/requisitions" },
  { label: "Ballots", icon: Vote, phase: "Phase 7" },
  { label: "Registry", icon: BookUser, phase: "Phase 8" },
];
