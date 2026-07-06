import { Coins, Sparkles } from "lucide-react";

// Merged credit + XP ledger row, sorted by createdAt desc by the caller.
// Keeping a single feed (rather than two tables) means the DM can see
// everything that happened to a player in one chronological scan.
export type HistoryRow = {
  id: string;
  type: "credit" | "xp";
  createdAt: Date;
  description: string;
  refCode: string | null;
  delta: number;
  after: string;
};

const typeMeta = {
  credit: { label: "Credit", icon: Coins, className: "text-signal-cyan" },
  xp: { label: "XP", icon: Sparkles, className: "text-signal-cyan" },
} as const;

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-6 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
        No credit or XP movement recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto bg-void-navy">
      <table className="w-full">
        <thead>
          <tr className="border-b border-elevated-ledger text-left font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-muted-ink">
            <th scope="col" className="px-4 py-2 font-semibold">Entry</th>
            <th scope="col" className="px-4 py-2 font-semibold">Type</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">Δ</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">After</th>
          </tr>
        </thead>
        <tbody className="font-[family-name:var(--font-jetbrains)] text-xs">
          {rows.map((e) => {
            const meta = typeMeta[e.type];
            const Icon = meta.icon;
            return (
              <tr
                key={e.id}
                className="border-b border-elevated-ledger/60 last:border-b-0"
              >
                <td className="px-4 py-2.5">
                  <span className="block font-[family-name:var(--font-inter)] text-sm text-case-file-white">
                    {e.description}
                  </span>
                  {e.refCode && (
                    <span className="text-[0.625rem] text-muted-ink">
                      {e.refCode}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${meta.className}`}>
                    <Icon size={12} aria-hidden="true" />
                    {meta.label}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2.5 text-right ${
                    e.delta >= 0 ? "text-signal-cyan" : "text-stamp-red"
                  }`}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {e.delta}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-muted-ink">
                  {e.after}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
