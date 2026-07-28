import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, MessageSquare } from "lucide-react";
import type { IndexKey, StockRow } from "@/lib/market-data";
import { actionLabel, signalSurface, signalTier } from "@/lib/signal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filter = "ALL" | IndexKey;

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function sentimentClass(s: StockRow["sentiment"]) {
  if (s === "Positive") return "bg-bull-soft text-bull";
  if (s === "Negative") return "bg-bear-soft text-bear";
  return "bg-muted text-muted-foreground";
}

function biasClass(b: StockRow["bias"]) {
  if (b === "bullish") return "text-bull";
  if (b === "bearish") return "text-foreground";
  return "text-muted-foreground";
}

function actionClass(s: StockRow) {
  return `${signalSurface(signalTier(s.conviction, s.signalTier))} font-semibold`;
}

function thesisClass(h: StockRow["thesisHealth"]) {
  if (h === "confirming") return "bg-bull-soft text-bull ring-1 ring-bull/40";
  if (h === "fading") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30";
  if (h === "invalidated") return "bg-bear-soft text-bear ring-1 ring-bear/40";
  if (h === "cooling" || h === "pending") return "bg-muted text-muted-foreground ring-1 ring-border";
  return "";
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}

function StockCard({ s }: { s: StockRow }) {
  const up = s.changePct >= 0;
  const vol = s.volume * 100000;
  const avg = s.avgVolume * 100000;
  const diff = vol - avg;
  const diffPct = avg ? (diff / avg) * 100 : 0;
  const diffUp = diff >= 0;
  return (
    <Link
      to="/stocks/$symbol"
      params={{ symbol: s.symbol }}
      className="group block rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-lg sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground group-hover:text-gold">
              {s.symbol}
            </h3>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.index}
            </span>
            {s.thesisHealth && s.thesisHealth !== "na" ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${thesisClass(s.thesisHealth)}`}
                title={s.thesisLabel ?? undefined}
              >
                {s.thesisHealth}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sentimentClass(s.sentiment)}`}
        >
          {s.sentiment}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
          ₹{fmt(s.ltp)}
        </div>
        <div
          className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}
        >
          {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {up ? "+" : ""}
          {s.changePct.toFixed(2)}%
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={`min-w-0 rounded-xl px-2.5 py-2 sm:px-3 ${up ? "bg-bull-soft/60" : "bg-muted"}`}>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bias
          </div>
          <div className={`mt-0.5 truncate text-base font-bold capitalize leading-tight sm:text-lg ${biasClass(s.bias)}`}>
            {s.bias}
          </div>
        </div>
        <div className={`min-w-0 rounded-xl px-2.5 py-2 ring-1 sm:px-3 ${actionClass(s)}`}>
          <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Action</div>
          <div className="mt-0.5 truncate text-base font-bold leading-tight sm:text-lg">
            {actionLabel(s.action)}
          </div>
          {s.actionNote ? (
            <div className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug opacity-80">
              {s.actionNote}
            </div>
          ) : null}
          {s.actionConfirm && s.actionConfirm !== "n/a" && s.actionConfirm !== "confirmed" ? (
            <div
              className={`mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                s.actionConfirm === "awaiting"
                  ? "bg-gold-soft text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.actionConfirm === "awaiting" ? "Awaiting vol confirm" : "Vol demoted"}
            </div>
          ) : null}
        </div>
      </div>

      {s.thesisHealth && s.thesisHealth !== "na" && s.thesisLabel ? (
        <div className={`mt-2 rounded-lg px-2.5 py-1.5 text-[10px] leading-snug ${thesisClass(s.thesisHealth)}`}>
          <span className="font-semibold uppercase tracking-wider">{s.thesisHealth}</span>
          <span className="opacity-80"> — {s.thesisLabel}</span>
          {s.thesisOpenMovePct != null ? (
            <span className="ml-1 font-mono tabular-nums opacity-70">
              · open {s.thesisOpenMovePct >= 0 ? "+" : ""}
              {s.thesisOpenMovePct.toFixed(2)}%
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 px-2.5 py-2 text-[10px] sm:px-3">
        <div className="min-w-0">
          <div className="font-semibold uppercase tracking-wider text-muted-foreground">Vol</div>
          <div className="mt-0.5 truncate font-mono tabular-nums text-foreground">{fmtInt(vol)}</div>
        </div>
        <div className="min-w-0">
          <div className="font-semibold uppercase tracking-wider text-muted-foreground">Avg</div>
          <div className="mt-0.5 truncate font-mono tabular-nums text-foreground">{fmtInt(avg)}</div>
        </div>
        <div className="min-w-0">
          <div className="font-semibold uppercase tracking-wider text-muted-foreground">Diff</div>
          <div
            className={`mt-0.5 truncate font-mono tabular-nums ${diffUp ? "text-bull" : "text-bear"}`}
          >
            {diffUp ? "+" : ""}
            {fmtInt(diff)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span className="font-medium text-foreground">{s.newsCount}</span> news
        </div>
        <div className="flex items-center gap-1">
          <span>Impact</span>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-primary"
              style={{ width: `${s.impact * 10}%` }}
            />
          </div>
          <span className="font-mono tabular-nums text-foreground">{s.impact}</span>
        </div>
      </div>
    </Link>
  );
}

type SentimentFilter = "ALL" | "Positive" | "Negative" | "Neutral";

export function StockTable({ stocks }: { stocks: StockRow[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sentiment, setSentiment] = useState<SentimentFilter>("ALL");

  const rows = useMemo(() => {
    let r = filter === "ALL" ? stocks : stocks.filter((s) => s.index === filter);
    if (sentiment !== "ALL") r = r.filter((s) => s.sentiment === sentiment);
    return [...r]
      .sort(
        (a, b) =>
          (a.latestNewsMins ?? 9999) - (b.latestNewsMins ?? 9999) ||
          b.impact - a.impact ||
          b.newsCount - a.newsCount,
      )
      .slice(0, 10);
  }, [filter, sentiment, stocks]);

  return (
    <div className="card-elevated flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl text-foreground sm:text-2xl">
            Top stocks in the news
          </h2>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Last 24 hours · newest headlines first
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="h-9 w-full min-w-[132px] flex-1 rounded-full border-border bg-card text-xs font-medium sm:w-[140px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All indices</SelectItem>
              <SelectItem value="NIFTY">Nifty 50</SelectItem>
              <SelectItem value="BANKNIFTY">Bank Nifty</SelectItem>
              <SelectItem value="SENSEX">Sensex</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sentiment} onValueChange={(v) => setSentiment(v as SentimentFilter)}>
            <SelectTrigger className="h-9 w-full min-w-[132px] flex-1 rounded-full border-border bg-card text-xs font-medium sm:w-[140px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sentiment</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
              <SelectItem value="Neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">
            No stocks linked from live headlines in the last 24h.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((s) => (
              <StockCard key={s.symbol} s={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
