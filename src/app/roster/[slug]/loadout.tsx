"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Power, PowerOff, Layers } from "lucide-react";
import { GameCard } from "@/components/cards/game-card";
import type { OwnedCard } from "@/lib/card-data";
import { setCardEquipped, type SheetState } from "@/app/roster/actions";

/*
 * Case File loadout (Phase 3). Shows the operator's equipped cards as full card
 * faces; the owner/admin can toggle equip and see the unequipped inventory.
 * Read-only viewers see equipped cards only. GameCard is a pure presentational
 * component, so it renders fine inside this client boundary.
 */
export function Loadout({
  characterId,
  owned,
  canEdit,
}: {
  characterId: string;
  owned: OwnedCard[];
  canEdit: boolean;
}) {
  const equipped = owned.filter((o) => o.equipped);
  const inventory = owned.filter((o) => !o.equipped);

  if (owned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Layers size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          No cards assigned
        </p>
        <p className="max-w-xs text-pretty text-xs text-muted-ink">
          {canEdit
            ? "Cards assigned by the DM appear here to equip."
            : "This operator has no cards on file yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CardGroup
        heading="Equipped"
        cards={equipped}
        characterId={characterId}
        canEdit={canEdit}
        emptyNote={canEdit ? "Nothing equipped — equip a card below." : "Nothing equipped."}
      />
      {canEdit && inventory.length > 0 && (
        <CardGroup
          heading="Inventory"
          cards={inventory}
          characterId={characterId}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function CardGroup({
  heading,
  cards,
  characterId,
  canEdit,
  emptyNote,
}: {
  heading: string;
  cards: OwnedCard[];
  characterId: string;
  canEdit: boolean;
  emptyNote?: string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
        {heading}
        <span className="ml-2 text-muted-ink">{cards.length}</span>
      </h3>
      {cards.length === 0 ? (
        <p className="text-xs text-muted-ink">{emptyNote}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((o) => (
            <li key={o.assignmentId} className="flex flex-col gap-2">
              <GameCard card={o.card} />
              {canEdit && (
                <EquipForm
                  characterId={characterId}
                  assignmentId={o.assignmentId}
                  equipped={o.equipped}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EquipForm({
  characterId,
  assignmentId,
  equipped,
}: {
  characterId: string;
  assignmentId: string;
  equipped: boolean;
}) {
  const [, formAction] = useActionState<SheetState, FormData>(
    setCardEquipped,
    {},
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="equipped" value={String(!equipped)} />
      <ToggleButton equipped={equipped} />
    </form>
  );
}

function ToggleButton({ equipped }: { equipped: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-1.5 border px-2 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-60 pointer-coarse:min-h-11 ${
        equipped
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan hover:bg-signal-cyan/20"
          : "border-steel-blue text-muted-ink hover:bg-elevated-ledger hover:text-signal-cyan"
      }`}
    >
      {equipped ? (
        <Power size={13} aria-hidden="true" />
      ) : (
        <PowerOff size={13} aria-hidden="true" />
      )}
      {pending ? "…" : equipped ? "Unequip" : "Equip"}
    </button>
  );
}
