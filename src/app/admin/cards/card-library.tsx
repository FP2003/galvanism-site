"use client";

import { useMemo, useState } from "react";
import { Search, Layers } from "lucide-react";
import { GameCard } from "@/components/cards/game-card";
import { TextInput } from "@/components/ui/form";
import { CARD_CATEGORIES, CARD_CATEGORY_META, type CardCategory } from "@/lib/cards";
import type { CardWithEffects } from "@/lib/schema";
import type { CardAssignmentTarget } from "@/lib/card-data";
import { CardMenu } from "./card-menu";

export interface CardLibraryItem {
  card: CardWithEffects;
  targets: CardAssignmentTarget[];
}

/*
 * Search + category filter over the admin card deck (Phase 3 follow-up). The
 * category chips double as the DM's "folders" — there's no separate folder
 * entity, just a filter over the existing `cardCategory` enum. Client-side
 * only: the DM's library is small enough that a full re-fetch per keystroke
 * would be overkill.
 */
export function CardLibrary({ items }: { items: CardLibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CardCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      ({ card }) =>
        (category === "all" || card.category === category) &&
        (q === "" || card.title.toLowerCase().includes(q)),
    );
  }, [items, query, category]);

  return (
    <div className="flex flex-col gap-4">
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
          placeholder="Search cards by name…"
          aria-label="Search cards by name"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {CARD_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            label={CARD_CATEGORY_META[c].label}
            color={CARD_CATEGORY_META[c].color}
            active={category === c}
            onClick={() => setCategory((cur) => (cur === c ? "all" : c))}
          />
        ))}
      </div>

      <p className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
        Showing {filtered.length} of {items.length}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Layers size={28} className="text-steel-blue" aria-hidden="true" />
          <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
            No cards match
          </p>
          <p className="max-w-xs text-pretty text-xs text-muted-ink">
            Try a different search term or category.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map(({ card, targets }) => (
            <li key={card.id}>
              <GameCard card={card} menu={<CardMenu cardId={card.id} title={card.title} targets={targets} />} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 border px-2.5 py-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] transition-colors ${
        active
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan"
          : "border-elevated-ledger text-muted-ink hover:border-steel-blue hover:text-case-file-white"
      }`}
    >
      {color && (
        <span
          className="size-2 shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      {label}
    </button>
  );
}
