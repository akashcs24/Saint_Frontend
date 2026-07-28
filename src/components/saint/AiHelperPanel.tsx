import { useState } from "react";
import { Sparkles } from "lucide-react";
import { fetchAiHelper, type AiHelperResult, type AiHelperVerdict } from "@/lib/api";

function verdictLabel(v: AiHelperVerdict) {
  if (v === "buy_now") return "Buy now";
  if (v === "wait_pullback") return "Wait pullback";
  if (v === "avoid_chase") return "Avoid chase";
  if (v === "short_now") return "Short now";
  if (v === "stay_out") return "Stay out";
  if (v === "watch") return "Watch";
  // legacy
  if (v === "support_long") return "Buy now";
  if (v === "support_short") return "Short now";
  if (v === "caution") return "Avoid chase";
  return "Watch";
}

function verdictClass(v: AiHelperVerdict) {
  if (v === "buy_now" || v === "support_long") return "bg-bull-soft text-bull";
  if (v === "short_now" || v === "support_short") return "bg-muted text-foreground";
  if (v === "avoid_chase" || v === "caution" || v === "wait_pullback") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
  return "bg-muted text-muted-foreground";
}

export function AiHelperPanel({ symbol }: { symbol: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiHelperResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAiHelper(symbol, force);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI helper failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/60 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI timing
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Entry now? · fresh RSI/EMA/MACD/VWAP/BB + news
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run(Boolean(result))}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <Sparkles className={`h-3.5 w-3.5 ${loading ? "animate-pulse text-gold" : "text-gold"}`} />
          {loading ? "Analysing…" : result ? "Refresh" : "Analyse"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] leading-snug text-bear">{error}</p>
      ) : null}

      {result?.ready ? (
        <div className="mt-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${verdictClass(result.verdict)}`}
            >
              {verdictLabel(result.verdict)}
            </span>
            {result.timing ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {result.timing}
              </span>
            ) : null}
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {result.confidence} conf
              {result.cached ? " · cached" : ""}
            </span>
          </div>
          <p className="font-serif text-sm leading-snug text-foreground">{result.headline}</p>
          {result.setup ? (
            <p className="text-[11px] leading-snug text-foreground/80">
              <span className="font-semibold text-muted-foreground">Setup · </span>
              {result.setup}
            </p>
          ) : null}
          {result.dataSources ? (
            <p className="text-[9px] text-muted-foreground">
              Sources: {result.dataSources.news ?? "saint"} news ·{" "}
              {result.dataSources.fundamentals ?? "yahoo"} F ·{" "}
              {result.dataSources.technicals ?? "ohlcv"} T
            </p>
          ) : null}
          {result.bullets?.length ? (
            <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">
              {result.bullets.map((b) => (
                <li key={b} className="flex gap-1.5">
                  <span className="text-foreground/40">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {result.conflicts?.length ? (
            <div className="rounded-lg bg-amber-500/10 px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Conflicts
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-foreground/90">
                {result.conflicts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
