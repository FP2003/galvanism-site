/*
 * Form primitives (Phase 2). The admin sheet and the player self-service panels
 * share these so every field carries the same label type, focus ring, and error/
 * status styling (DESIGN.md §5). Field wires label↔control via a generated id.
 */
import { forwardRef, useId } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";

export const fieldLabelClass =
  "font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-ink";

const controlClass =
  "w-full border border-elevated-ledger bg-void-navy px-3 py-2.5 font-[family-name:var(--font-inter)] text-sm text-case-file-white placeholder:text-muted-ink/70 outline-none focus:border-signal-cyan disabled:opacity-60";

type FieldProps = {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      {children(id)}
      {hint && (
        <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
          {hint}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
>(function TextInput({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`${controlClass} ${className}`} {...rest} />;
});

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    className?: string;
  },
) {
  const { className = "", ...rest } = props;
  return <textarea className={`${controlClass} ${className}`} {...rest} />;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    className?: string;
    // Only needed to grow the control inside a horizontal flex row (e.g.
    // beside a submit button). Leave unset in a Field — the wrapper already
    // gets full width from the column's default cross-axis stretch, and
    // `flex-1` there would grow the wrapper vertically instead, detaching
    // the chevron's centering from the visible select box.
    wrapperClassName?: string;
  },
) {
  const { className = "", wrapperClassName = "", children, ...rest } = props;
  return (
    <div className={`relative min-w-0 ${wrapperClassName}`}>
      <select
        className={`${controlClass} appearance-none pr-9 ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-steel-blue"
      />
    </div>
  );
}

export function FormMessage({
  state,
}: {
  state: { ok?: boolean; error?: string; message?: string };
}) {
  // Filled treatments, not tinted text: raw stamp-red / signal-cyan text fails
  // contrast on Ledger-Teal panels, where these forms live (DESIGN.md §2). A solid
  // fill reads correctly on any surface and drops the banned side-stripe accent.
  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 bg-stamp-red px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white"
      >
        <AlertTriangle size={15} className="mt-px shrink-0" aria-hidden="true" />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 bg-signal-cyan px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-void-navy"
      >
        <Check size={15} className="mt-px shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    );
  }
  return null;
}
