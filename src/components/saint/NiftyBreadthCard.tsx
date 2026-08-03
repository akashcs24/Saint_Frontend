import type { NiftyBreadth, NiftyBreadthSegment, NiftyPcr, TrendArrows } from "@/lib/market-data";
import { actionLabel, signalSurface } from "@/lib/signal";

type Dir = TrendArrows["m5"];

function arrowGlyph(dir: Dir) {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  if (dir === "flat") return "→";
  return "·";
}

function arrowClass(dir: Dir, invertColors = false) {
  // invertColors: for decline-weight, up (more red weight) = bearish colour
  if (dir == null) return "text-muted-foreground/40";
  if (dir === "flat") return "text-muted-foreground";
  const bullish = invertColors ? dir === "down" : dir === "up";
  return bullish ? "text-bull" : "text-bear";
}

/** Two arrows: 1st = vs 5m, 2nd = vs 15m. */
function DualTrendArrows({
  trend,
  invertColors = false,
  title,
}: {
  trend?: TrendArrows | null;
  invertColors?: boolean;
  title: string;
}) {
  const m5 = trend?.m5 ?? null;
  const m15 = trend?.m15 ?? null;
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-[11px] font-bold leading-none"
      title={`${title}\n5m: ${m5 ?? "warming up"}\n15m: ${m15 ?? "warming up"}`}
      aria-label={`${title}: 5 minutes ${m5 ?? "pending"}, 15 minutes ${m15 ?? "pending"}`}
    >
      <span className={arrowClass(m5, invertColors)}>{arrowGlyph(m5)}</span>
      <span className={arrowClass(m15, invertColors)}>{arrowGlyph(m15)}</span>
    </span>
  );
}

function pcrTone(lean: NiftyPcr["lean"]) {
  if (lean === "bullish" || lean === "mild_bullish") return "text-bull";
  if (lean === "bearish" || lean === "mild_bearish") return "text-bear";
  return "text-foreground";
}

function PcrRow({ pcr }: { pcr?: NiftyPcr | null }) {
  if (!pcr?.ready || pcr.oiPcr == null) {
    return (
      <div className="mt-2.5 flex items-baseline justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-2">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nifty PCR · OI
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Fetching option-chain PCR…</p>
        </div>
        <span className="font-mono text-sm font-bold tabular-nums text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="mt-2.5 flex items-baseline justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-2">
      <div className="min-w-0">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Nifty PCR · OI{pcr.expiry ? ` · ${pcr.expiry}` : ""}
          <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/80">
            5m · 15m
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{pcr.label}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className={`font-mono text-sm font-bold tabular-nums ${pcrTone(pcr.lean)}`}>
            {pcr.oiPcr.toFixed(2)}
          </span>
          <DualTrendArrows trend={pcr.trend} title="PCR trend (5m · 15m)" />
        </div>
        {pcr.volumePcr != null ? (
          <div className="font-mono text-[9px] tabular-nums text-muted-foreground">
            vol {pcr.volumePcr.toFixed(2)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function leanTier(lean: NiftyBreadth["lean"], contribution: number | null) {
  if (lean === "bullish" || lean === "bearish") {
    const abs = Math.abs(contribution ?? 0);
    if (abs >= 0.35) return "strong" as const;
    if (abs >= 0.12) return "medium" as const;
  }
  return "weak" as const;
}

function segmentClass(side: NiftyBreadthSegment["side"]) {
  if (side === "up") return "bg-bull";
  if (side === "down") return "bg-bear";
  return "bg-muted-foreground/35";
}

const TAPE_H = "h-1.5";

/** Count bar — equal stock units (headcount A/D). */
function CountTape({ breadth }: { breadth: NiftyBreadth }) {
  const total = breadth.advances + breadth.declines + breadth.unchanged || 1;
  const advPct = (breadth.advances / total) * 100;
  const decPct = (breadth.declines / total) * 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>By count</span>
        <span>
          {breadth.advances}↑ · {breadth.unchanged}· · {breadth.declines}↓
        </span>
      </div>
      <div className={`flex ${TAPE_H} overflow-hidden rounded-full bg-muted`} title="Equal weight per stock">
        <div className="bg-bull" style={{ width: `${advPct}%` }} />
        <div className="bg-muted-foreground/30" style={{ width: `${100 - advPct - decPct}%` }} />
        <div className="bg-bear" style={{ width: `${decPct}%` }} />
      </div>
    </div>
  );
}

/** Weight tape — each segment width = Nifty free-float weight. */
function WeightTape({
  segments,
  weightUp,
  weightDown,
  weightFlat,
  weightTrend,
}: {
  segments: NiftyBreadthSegment[];
  weightUp: number;
  weightDown: number;
  weightFlat: number;
  weightTrend?: NiftyBreadth["weightTrend"];
}) {
  if (!segments.length) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>By Nifty weight</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className="inline-flex items-center gap-0.5">
            <span className="tabular-nums">{weightUp.toFixed(0)}%↑</span>
            <DualTrendArrows trend={weightTrend?.up} title="Advance weight trend (5m · 15m)" />
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="tabular-nums">{weightFlat.toFixed(0)}%·</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="inline-flex items-center gap-0.5">
            <span className="tabular-nums">{weightDown.toFixed(0)}%↓</span>
            <DualTrendArrows
              trend={weightTrend?.down}
              invertColors
              title="Decline weight trend (5m · 15m) — ↑ means more weight declining"
            />
          </span>
        </span>
      </div>
      <div
        className={`flex ${TAPE_H} overflow-hidden rounded-full bg-muted`}
        role="img"
        aria-label={`Weight tape: ${weightUp.toFixed(0)} percent advancing, ${weightDown.toFixed(0)} percent declining`}
      >
        {segments.map((s) => (
          <div
            key={s.symbol}
            className={`${segmentClass(s.side)} min-w-px transition-opacity hover:opacity-80`}
            style={{ flexGrow: Math.max(s.weight, 0.2), flexBasis: 0 }}
            title={`${s.symbol} · wt ${s.weight.toFixed(1)}% · ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span className="text-bull">Advances (left)</span>
        <span className="text-bear">Declines (right)</span>
      </div>
    </div>
  );
}

export function NiftyBreadthCard({ breadth }: { breadth?: NiftyBreadth | null }) {
  if (!breadth) return null;

  const tier = leanTier(breadth.lean, breadth.contributionPct);
  const action = actionLabel(breadth.action);
  const contrib = breadth.contributionPct;
  const segments = breadth.segments ?? [];

  return (
    <section className="rounded-xl border border-border bg-muted/30 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-serif text-base text-foreground">Nifty breadth</h3>
          <p className="text-[10px] text-muted-foreground">
            Count · weight · PCR
            {breadth.ready ? ` · ${breadth.quoted}/${breadth.universe}` : ""}
            {breadth.quoteSource
              ? ` · ${breadth.quoteSource === "fyers" ? "Fyers live" : breadth.quoteSource}`
              : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${signalSurface(tier, { ring: false })}`}
        >
          {breadth.label.toLowerCase().includes("whipsaw")
            ? "Whipsaw"
            : action === "Watch"
              ? breadth.lean === "mixed"
                ? "Mixed"
                : "Watch"
              : action}
        </span>
      </div>

      <PcrRow pcr={breadth.pcr} />

      {!breadth.ready ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{breadth.label}</p>
      ) : (
        <>
          <div className="mt-3 space-y-2.5">
            <CountTape breadth={breadth} />
            <WeightTape
              segments={segments}
              weightUp={breadth.weightUp}
              weightDown={breadth.weightDown}
              weightFlat={breadth.weightFlat}
              weightTrend={breadth.weightTrend}
            />
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="text-[11px] leading-snug text-muted-foreground">{breadth.label}</p>
            {contrib != null ? (
              <span
                className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
                  contrib >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {contrib >= 0 ? "+" : ""}
                {contrib.toFixed(2)} pts
              </span>
            ) : null}
          </div>

          {(breadth.topUp.length > 0 || breadth.topDown.length > 0) ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="font-semibold uppercase tracking-wider text-muted-foreground">Lift</div>
                <ul className="mt-0.5 space-y-0.5">
                  {breadth.topUp.map((m) => (
                    <li key={m.symbol} className="flex justify-between gap-1 font-mono tabular-nums">
                      <span className="text-foreground">{m.symbol}</span>
                      <span className="text-bull">
                        +{m.changePct.toFixed(1)}% · {m.weight.toFixed(1)}w
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wider text-muted-foreground">Drag</div>
                <ul className="mt-0.5 space-y-0.5">
                  {breadth.topDown.map((m) => (
                    <li key={m.symbol} className="flex justify-between gap-1 font-mono tabular-nums">
                      <span className="text-foreground">{m.symbol}</span>
                      <span className="text-bear">
                        {m.changePct.toFixed(1)}% · {m.weight.toFixed(1)}w
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
