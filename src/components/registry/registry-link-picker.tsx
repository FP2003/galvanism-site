"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link2, Search, X } from "lucide-react";
import { TextInput } from "@/components/ui/form";
import { RegistryTypeIcon } from "./registry-type-icon";
import { registryHref, type RegistryEntryType } from "@/lib/registry";
import { listPublicRegistryEntriesForPicker } from "@/app/registry-picker-actions";

type PickerEntry = { slug: string; name: string; type: RegistryEntryType };

/*
 * Inserts a `[Name](/registry/slug)` markdown link into a sibling textarea at
 * the cursor position (Phase 8's manual-linking decision — no auto name
 * detection). Fetches its own entry list lazily on first open via a server
 * action, rather than threading `registryEntries` as a prop through every
 * dialog/menu wrapper that renders the host form (NewMissionDialog,
 * MissionMenu, CardMenu, ...). Only ever offers public entries, so a hidden
 * entry can't be linked into player-visible prose from here.
 */
export function RegistryLinkPicker({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PickerEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && entries === null && !loading) {
      setLoading(true);
      listPublicRegistryEntriesForPicker()
        .then(setEntries)
        .finally(() => setLoading(false));
    }
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!entries) return [];
    if (q === "") return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, query]);

  function insert(entry: PickerEntry) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const snippet = `[${entry.name}](${registryHref(entry.slug)})`;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
    const cursor = start + snippet.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 border border-elevated-ledger px-2 py-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-muted-ink transition-colors hover:border-steel-blue hover:text-signal-cyan pointer-coarse:min-h-11"
      >
        <Link2 size={12} aria-hidden="true" />
        Link registry entry
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 border border-steel-blue bg-elevated-ledger p-2">
          <div className="relative mb-2">
            <Search
              size={13}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-blue"
            />
            <TextInput
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search public entries…"
              aria-label="Search public registry entries"
              className="py-1.5 pl-8 pr-7 text-xs"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-blue hover:text-case-file-white"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>

          <ul role="listbox" className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {loading && (
              <li className="px-2 py-1.5 font-[family-name:var(--font-inter)] text-xs text-muted-ink">
                Loading…
              </li>
            )}
            {!loading && entries !== null && filtered.length === 0 && (
              <li className="px-2 py-1.5 font-[family-name:var(--font-inter)] text-xs text-muted-ink">
                No public entries match.
              </li>
            )}
            {filtered.map((entry) => (
              <li key={entry.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => insert(entry)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-[family-name:var(--font-inter)] text-xs text-case-file-white transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none pointer-coarse:min-h-11"
                >
                  <RegistryTypeIcon type={entry.type} size={13} className="shrink-0 text-steel-blue" />
                  <span className="truncate">{entry.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
