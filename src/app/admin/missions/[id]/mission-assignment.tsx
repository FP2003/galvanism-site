"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, FormMessage } from "@/components/ui/form";
import {
  assignCharacterDirect,
  confirmAssignment,
  removeAssignment,
  type FormState,
} from "@/app/admin/mission-actions";
import type { Character } from "@/lib/schema";

export interface AssignmentRow {
  id: string;
  state: "interested" | "assigned";
  character: Pick<Character, "id" | "callsign" | "rank" | "role">;
}

/*
 * Admin mission assignment (Phase 5). Interested operators await a Confirm/
 * Reject; assigned operators can be unassigned; the direct-assign picker adds
 * (or promotes) any eligible character straight to Assigned. Modeled directly
 * on admin/players/[id]/card-assignment.tsx's select-to-add + list-with-
 * remove-button pattern.
 */
export function MissionAssignment({
  missionId,
  eligible,
  assignments,
}: {
  missionId: string;
  eligible: Character[];
  assignments: AssignmentRow[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(assignCharacterDirect, {});
  const interested = assignments.filter((a) => a.state === "interested");
  const assigned = assignments.filter((a) => a.state === "assigned");

  return (
    <div className="flex flex-col gap-5">
      {eligible.length === 0 ? (
        <p className="border border-signal-cyan/40 bg-signal-cyan/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
          Every eligible operator is already on this mission.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="missionId" value={missionId} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              name="characterId"
              aria-label="Operator to assign"
              defaultValue=""
              wrapperClassName="flex-1"
            >
              <option value="" disabled>
                Assign directly…
              </option>
              {eligible.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.callsign}
                </option>
              ))}
            </Select>
            <AssignButton />
          </div>
          <FormMessage state={state} />
        </form>
      )}

      <div>
        <h3 className="mb-2 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Interested ({interested.length})
        </h3>
        {interested.length === 0 ? (
          <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
            No operators have expressed interest yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
            {interested.map((row) => (
              <InterestRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Assigned ({assigned.length})
        </h3>
        {assigned.length === 0 ? (
          <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
            No operators assigned yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
            {assigned.map((row) => (
              <AssignedRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AssignButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      <Plus size={15} />
      {pending ? "Assigning…" : "Assign"}
    </Button>
  );
}

function InterestRow({ row }: { row: AssignmentRow }) {
  const [, confirmAction] = useActionState<FormState, FormData>(confirmAssignment, {});
  const [, removeAction] = useActionState<FormState, FormData>(removeAssignment, {});
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-muted-ink" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {row.character.callsign}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {[row.character.role, row.character.rank].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <form action={confirmAction}>
        <input type="hidden" name="assignmentId" value={row.id} />
        <IconButton label={`Confirm ${row.character.callsign}`} tone="confirm">
          <Check size={14} aria-hidden="true" />
        </IconButton>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={row.id} />
        <IconButton label={`Reject ${row.character.callsign}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

function AssignedRow({ row }: { row: AssignmentRow }) {
  const [, removeAction] = useActionState<FormState, FormData>(removeAssignment, {});
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-signal-cyan" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {row.character.callsign}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {[row.character.role, row.character.rank].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={row.id} />
        <IconButton label={`Unassign ${row.character.callsign}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

function IconButton({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "danger" | "confirm";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className={`flex size-8 shrink-0 items-center justify-center border transition-colors disabled:opacity-60 pointer-coarse:size-11 ${
        tone === "danger"
          ? "border-elevated-ledger text-muted-ink hover:border-stamp-red hover:text-stamp-red"
          : "border-elevated-ledger text-muted-ink hover:border-signal-cyan hover:text-signal-cyan"
      }`}
    >
      {children}
    </button>
  );
}
