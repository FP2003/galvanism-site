"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { Select, TextInput, FormMessage, fieldLabelClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { CARD_CATEGORIES, CARD_CATEGORY_META } from "@/lib/cards";
import {
  addRestockRule,
  deleteRestockRule,
  type FormState,
} from "@/app/admin/shop-actions";
import type { ShopRestockRule } from "@/lib/schema";

// The admin's weighted restock pool for a shop (Phase 4). Each rule is an
// independent row with its own add/delete lifecycle — no dynamic client-
// array builder needed, unlike card effects which save atomically with
// their card.
export function RestockRules({
  shopId,
  rules,
}: {
  shopId: string;
  rules: ShopRestockRule[];
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addRestockRule, {});

  return (
    <div className="flex flex-col gap-4">
      {rules.length === 0 ? (
        <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
          No restock rules yet — rotating slots stay empty until you add some.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </ul>
      )}

      <form action={addAction} className="flex flex-col gap-2">
        <input type="hidden" name="shopId" value={shopId} />
        <Select name="category" aria-label="Category" defaultValue={CARD_CATEGORIES[0]}>
          {CARD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CARD_CATEGORY_META[c].label}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Level</span>
            <TextInput
              name="level"
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Level"
              placeholder="Level"
              defaultValue={1}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1">
              <span className={fieldLabelClass}>Weight</span>
              <InfoTooltip label="Sets the odds this rule is picked for a slot, relative to the shop's other rules. E.g. weight 80 vs. weight 20 draws this rule 80% of the time — only the ratio between rules matters." />
            </span>
            <TextInput
              name="weight"
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Weight"
              placeholder="Weight"
            />
          </div>
        </div>
        <AddRuleButton />
      </form>
      <FormMessage state={addState} />
    </div>
  );
}

function AddRuleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      <Plus size={15} />
      {pending ? "Adding…" : "Add rule"}
    </Button>
  );
}

function RuleRow({ rule }: { rule: ShopRestockRule }) {
  const [, deleteAction] = useActionState<FormState, FormData>(deleteRestockRule, {});
  const label = `${CARD_CATEGORY_META[rule.category].label} · Level ${rule.level}`;

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-steel-blue" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {label}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          Weight {rule.weight}
        </p>
      </div>
      <form action={deleteAction}>
        <input type="hidden" name="ruleId" value={rule.id} />
        <RemoveRuleButton label={`Remove ${label} rule`} />
      </form>
    </li>
  );
}

function RemoveRuleButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:size-11"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
