/*
 * Form primitives (Phase 2). The admin sheet and the player self-service panels
 * share these so every field carries the same label type, focus ring, and error/
 * status styling (DESIGN.md §5). Field wires label↔control via a generated id.
 */
import { useId } from "react";
import { AlertTriangle, Check } from "lucide-react";

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

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string },
) {
  const { className = "", ...rest } = props;
  return <input className={`${controlClass} ${className}`} {...rest} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    className?: string;
  },
) {
  const { className = "", ...rest } = props;
  return <textarea className={`${controlClass} ${className}`} {...rest} />;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string },
) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`${controlClass} ${className}`} {...rest}>
      {children}
    </select>
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
