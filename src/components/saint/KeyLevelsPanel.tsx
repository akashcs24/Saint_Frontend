import type { StockRow } from "@/lib/market-data";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Vertical price ladder: resistance → LTP → support (and VWAP when present).
 * Purely presentational from levels already on the stock payload.
 */
export function KeyLevelsPanel({ stock }: { stock: StockRow }) {
  const ltp = stock.ltp;
  const res = stock.nearestResistance ?? null;
  const sup = stock.nearestSupport ?? null;
  const vwap = stock.sessionVwap ?? null;

  const levels: { key: string; label: string; price: number; tone: "res" | "sup" | "vwap" | "ltp" }[] = [
    ...(res != null ? [{ key: "res", label: "Resistance", price: res, tone: "res" as const }] : []),
    ...(vwap != null ? [{ key: "vwap", label: "Prior VWAP", price: vwap, tone: "vwap" as const }] : []),
    { key: "ltp", label: "LTP", price: ltp, tone: "ltp" as const },
    ...(sup != null ? [{ key: "sup", label: "Support", price: sup, tone: "sup" as const }] : []),
  ].sort((a, b) => b.price - a.price);

  if (levels.length <= 1) {
    return (
      <div className="rounded-xl border border-border px-3 py-4 text-center text-xs text-muted-foreground">
        Key levels unavailable for this name yet.
      </div>
    );
  }

  const hi = levels[0].price;
  const lo = levels[levels.length - 1].price;
  const span = Math.max(hi - lo, ltp * 0.01);

  const toneClass = (tone: (typeof levels)[0]["tone"]) => {
    if (tone === "res") return "text-bear";
    if (tone === "sup") return "text-bull";
    if (tone === "vwap") return "text-gold";
    return "text-foreground";
  };

  const markClass = (tone: (typeof levels)[0]["tone"]) => {
    if (tone === "res") return "bg-bear";
    if (tone === "sup") return "bg-bull";
    if (tone === "vwap") return "bg-gold";
    return "bg-foreground";
  };

  return (
    <div className="rounded-xl border border-border px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Key levels
        </h3>
        <div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-wider text-muted-foreground">
          {stock.distResistPct != null ? (
            <span>
              To R <span className="font-mono text-foreground">{stock.distResistPct.toFixed(1)}%</span>
            </span>
          ) : null}
          {stock.distSupportPct != null ? (
            <span>
              To S <span className="font-mono text-foreground">{stock.distSupportPct.toFixed(1)}%</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 ml-1 h-36">
        <div className="absolute bottom-0 left-2 top-0 w-px bg-border" />
        {levels.map((lv) => {
          const pct = ((lv.price - lo) / span) * 100;
          return (
            <div
              key={lv.key}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ bottom: `calc(${pct}% - 8px)` }}
            >
              <span className={`relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ${markClass(lv.tone)}`} />
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 border-b border-dashed border-border/70 pb-0.5">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${toneClass(lv.tone)}`}>
                  {lv.label}
                </span>
                <span className={`font-mono text-xs font-semibold tabular-nums ${toneClass(lv.tone)}`}>
                  ₹{fmt(lv.price)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
