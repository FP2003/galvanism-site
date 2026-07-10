import {
  Radar,
  Users,
  Crosshair,
  Factory,
  Vote,
  BookUser,
  IdCard,
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
  { label: "Registry", icon: BookUser, href: "/registry" },
];

// Players get a "My Case File" shortcut to their own operator sheet, slotted in
// right after Command. It's viewer-specific (depends on the signed-in player's
// character slug), so the shell computes the href server-side and passes it in;
// admins and not-yet-enlisted players pass null and see the base nav unchanged.
export function buildNavItems(myCaseFileHref: string | null): NavItem[] {
  if (!myCaseFileHref) return navItems;
  const [command, ...rest] = navItems;
  return [
    command,
    { label: "My Case File", icon: IdCard, href: myCaseFileHref },
    ...rest,
  ];
}

// Shared active-state rule for the sidebar and mobile nav. The "My Case File"
// href lives under /roster/, so Roster's prefix match would otherwise also light
// up on the viewer's own sheet — this keeps exactly one item active there.
export function isNavActive(
  item: NavItem,
  pathname: string,
  myCaseFileHref: string | null,
): boolean {
  if (!item.href) return false;
  if (item.href === "/") return pathname === "/";
  if (item.href === "/roster") {
    return pathname.startsWith("/roster") && pathname !== myCaseFileHref;
  }
  if (myCaseFileHref && item.href === myCaseFileHref) {
    return pathname === myCaseFileHref;
  }
  return pathname.startsWith(item.href);
}
