import { UserRound, MapPin, Flag, Package, CalendarClock, type LucideIcon } from "lucide-react";
import { REGISTRY_TYPE_META, type RegistryEntryType } from "@/lib/registry";

// Maps lib/registry.ts's React-free icon keys to actual lucide components —
// kept out of lib/registry.ts so that file stays testable without a React
// import, same split as game-card.tsx does for CARD_CATEGORY_META.
const ICONS: Record<string, LucideIcon> = {
  npc: UserRound,
  location: MapPin,
  faction: Flag,
  item: Package,
  event: CalendarClock,
};

export function RegistryTypeIcon({
  type,
  size = 14,
  className,
}: {
  type: RegistryEntryType;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[REGISTRY_TYPE_META[type].icon] ?? UserRound;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
