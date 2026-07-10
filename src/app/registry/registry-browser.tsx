"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookUser, ChevronRight } from "lucide-react";
import { TextInput } from "@/components/ui/form";
import { StatusLabel } from "@/components/ui/status-dot";
import { RegistryTypeIcon } from "@/components/registry/registry-type-icon";
import { REGISTRY_TYPES, REGISTRY_TYPE_META, registryHref, type RegistryEntryType } from "@/lib/registry";
import type { getPublicRegistryEntries } from "@/lib/registry-data";

type PublicRegistryEntry = Awaited<ReturnType<typeof getPublicRegistryEntries>>[number];

// Search + type filter over the public registry (Phase 8), same
// client-side-filter shape as the admin RegistryList — the roster of public
// entries is small enough that a full re-fetch per keystroke is overkill.
export function RegistryBrowser({ entries }: { entries: PublicRegistryEntry[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RegistryEntryType | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (type === "all" || entry.type === type) &&
        (q === "" || entry.name.toLowerCase().includes(q)),
    );
  }, [entries, query, type]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 p-5 pb-0">
        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-blue"
          />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the registry by name…"
            aria-label="Search the registry by name"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <TypeChip label="All" active={type === "all"} onClick={() => setType("all")} />
          {REGISTRY_TYPES.map((t) => (
            <TypeChip
              key={t}
              type={t}
              label={REGISTRY_TYPE_META[t].label}
              active={type === t}
              onClick={() => setType((cur) => (cur === t ? "all" : t))}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 pb-5 pt-2 text-center">
          <BookUser size={28} className="text-steel-blue" aria-hidden="true" />
          <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
            {entries.length === 0 ? "Nothing on record yet" : "No entries match"}
          </p>
          <p className="max-w-xs text-pretty text-xs text-muted-ink">
            {entries.length === 0
              ? "Check back once command has logged something."
              : "Try a different search term or type."}
          </p>
        </div>
      ) : (
        <ul>
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="border-b border-elevated-ledger last:border-b-0"
            >
              <Link
                href={registryHref(entry.slug)}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-elevated-ledger"
              >
                <RegistryTypeIcon type={entry.type} size={18} className="shrink-0 text-steel-blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                      {entry.name}
                    </span>
                    <StatusLabel tone="neutral">{REGISTRY_TYPE_META[entry.type].label}</StatusLabel>
                  </div>
                  {entry.description && (
                    <p className="mt-1 truncate font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
                      {entry.description}
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TypeChip({
  type,
  label,
  active,
  onClick,
}: {
  type?: RegistryEntryType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 border px-2.5 py-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] transition-colors pointer-coarse:min-h-11 ${
        active
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan"
          : "border-elevated-ledger text-muted-ink hover:border-steel-blue hover:text-case-file-white"
      }`}
    >
      {type && <RegistryTypeIcon type={type} size={12} />}
      {label}
    </button>
  );
}
