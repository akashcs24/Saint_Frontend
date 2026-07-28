import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { IndexQuote } from "@/lib/market-data";

const SHOWN = ["NIFTY", "BANKNIFTY", "SENSEX", "VIX"];
const PRIORITY = ["NIFTY", "BANKNIFTY", "SENSEX"];

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function IndicesStrip({ indices }: { indices: IndexQuote[] }) {
  const items = SHOWN.map((key) => indices.find((i) => i.key === key)).filter(
    (x): x is IndexQuote => Boolean(x),
  );

  if (items.length === 0) {
    return (
      <section aria-label="Session indices" className="card-elevated px-5 py-8 text-center text-sm text-muted-foreground">
        No index quotes returned from Yahoo yet.
      </section>
    );
  }

  return (
    <section aria-label="Session indices" className="relative">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((idx) => {
          const up = idx.changePct >= 0;
          const priority = PRIORITY.includes(String(idx.key));
          return (
            <div
              key={idx.key}
              className={`card-elevated relative overflow-hidden p-3 sm:p-4 ${
                priority ? "ring-1 ring-gold/30" : ""
              }`}
            >
              {priority && (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-gold-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold">
                  Core
                </span>
              )}
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span className="truncate">{idx.name}</span>
              </div>
              <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg md:text-xl">
                {fmt(idx.ltp)}
              </div>
              <div
                className={`mt-0.5 inline-flex max-w-full flex-wrap items-center gap-1 text-[10px] font-medium tabular-nums sm:text-[11px] ${
                  up ? "text-bull" : "text-bear"
                }`}
              >
                {up ? <ArrowUpRight className="h-3 w-3 shrink-0" /> : <ArrowDownRight className="h-3 w-3 shrink-0" />}
                <span className="truncate">
                  {up ? "+" : ""}
                  {fmt(idx.change)} ({up ? "+" : ""}
                  {idx.changePct.toFixed(2)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
