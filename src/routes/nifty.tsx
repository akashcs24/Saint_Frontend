import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header } from "@/components/saint/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchNiftyBoard,
  NIFTY_QUERY_KEY,
  type NiftyBoardDriver,
  type NiftyBoardPayload,
  type NiftyBreadthHistoryRow,
  type NiftyPcrHistoryRow,
} from "@/lib/api";
import { isLiveDataWindow, LIVE_DATA_LABEL } from "@/lib/market-hours";

const REFRESH_MS = 60_000;

export const Route = createFileRoute("/nifty")({
  loader: () => null,
  pendingMs: 0,
  head: () => ({
    meta: [
      { title: "Market · Saint Infinite Market" },
      {
        name: "description",
        content: "Nifty spot, breadth tape, ATM option OI, PCR history, and basket lead/lag.",
      },
    ],
  }),
  component: NiftyPage,
});

function fmtNum(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtInt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-IN");
}

function pctClass(n: number | null | undefined) {
  if (n == null || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-bull" : "text-bear";
}

function sentimentClass(s?: string | null) {
  if (!s) return "text-foreground";
  if (s.includes("bull")) return "text-bull";
  if (s.includes("bear")) return "text-bear";
  return "text-foreground";
}

/** Map backend sentiment → trader-facing verdict chip. */
function oiVerdict(s?: string | null): { label: string; className: string } {
  const key = (s || "").toLowerCase();
  if (key === "bullish") {
    return { label: "Bullish", className: "bg-bull-soft text-bull" };
  }
  if (key === "mild_bullish") {
    return { label: "Mildly Bullish", className: "bg-bull-soft/70 text-bull" };
  }
  if (key === "bearish") {
    return { label: "Bearish", className: "bg-bear-soft text-bear" };
  }
  if (key === "mild_bearish") {
    return { label: "Mildly Bearish", className: "bg-bear-soft/70 text-bear" };
  }
  return { label: "Sideways", className: "bg-muted text-muted-foreground" };
}

/** Colour only answers: is printed Nifty ahead of / lagging the basket baseline? */
function niftyVsBasketClass(
  indexVsBasketPp: number | null | undefined,
  syncBandPp = 0.08,
) {
  if (indexVsBasketPp == null || Math.abs(indexVsBasketPp) < syncBandPp) {
    return "text-muted-foreground";
  }
  return indexVsBasketPp > 0 ? "text-bull" : "text-bear";
}

function syncVerdictChip(stance?: string | null): { label: string; className: string } {
  if (stance === "nifty_ahead" || stance === "ahead") {
    return { label: "Nifty ahead", className: "bg-bull-soft text-bull" };
  }
  if (stance === "nifty_lagging" || stance === "lagging") {
    return { label: "Nifty lagging", className: "bg-bear-soft text-bear" };
  }
  if (stance === "in_sync" || stance === "aligned") {
    return { label: stance === "aligned" ? "Aligned" : "In sync", className: "bg-muted text-muted-foreground" };
  }
  if (stance === "cash_more_nifty_led") {
    return { label: "Cash more Nifty-led", className: "bg-bull-soft/70 text-bull" };
  }
  if (stance === "fo_more_nifty_led") {
    return { label: "FO more Nifty-led", className: "bg-bear-soft/70 text-bear" };
  }
  return { label: "—", className: "bg-muted text-muted-foreground" };
}

function formatGapPp(
  pp: number | null | undefined,
  pts: number | null | undefined,
) {
  if (pp == null) return "—";
  const core = `${pp >= 0 ? "+" : ""}${fmtNum(pp, 3)}pp`;
  if (pts == null) return core;
  return `${core} (~${pts >= 0 ? "+" : ""}${fmtNum(pts, 1)} pts)`;
}

function SyncRow({
  title,
  subtitle,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  gapLabel,
  gapValue,
  gapClass,
  verdict,
}: {
  title: string;
  subtitle?: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  gapLabel: string;
  gapValue: string;
  gapClass: string;
  verdict?: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          {subtitle ? <div className="text-[10px] text-muted-foreground">{subtitle}</div> : null}
        </div>
        {verdict ? (
          <span className={`shrink-0 text-[10px] font-semibold ${gapClass}`}>{verdict}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-muted/40 px-2 py-1.5">
          <div className="text-muted-foreground">{leftLabel}</div>
          <div className="font-mono font-semibold tabular-nums text-foreground">{leftValue}</div>
        </div>
        <div className="rounded-md bg-muted/40 px-2 py-1.5">
          <div className="text-muted-foreground">{rightLabel}</div>
          <div className={`font-mono font-semibold tabular-nums ${gapClass}`}>{rightValue}</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5">
        <span className="text-[10px] text-muted-foreground">{gapLabel}</span>
        <span className={`font-mono text-sm font-semibold tabular-nums ${gapClass}`}>{gapValue}</span>
      </div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/70 ${className}`} />;
}

function CountTape({
  advances,
  declines,
  unchanged,
}: {
  advances: number;
  declines: number;
  unchanged: number;
}) {
  const total = advances + declines + unchanged || 1;
  const advPct = (advances / total) * 100;
  const decPct = (declines / total) * 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>By count</span>
        <span>
          {advances}↑ · {unchanged}· · {declines}↓
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-bull" style={{ width: `${advPct}%` }} />
        <div className="bg-muted-foreground/30" style={{ width: `${100 - advPct - decPct}%` }} />
        <div className="bg-bear" style={{ width: `${decPct}%` }} />
      </div>
    </div>
  );
}

function WeightTape({
  segments,
  weightUp,
  weightDown,
  weightFlat,
}: {
  segments: NonNullable<NiftyBoardPayload["breadth"]["segments"]>;
  weightUp: number;
  weightDown: number;
  weightFlat: number;
}) {
  if (!segments.length) {
    return (
      <div>
        <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>By Nifty weight</span>
          <span>
            {weightUp.toFixed(0)}%↑ · {weightFlat.toFixed(0)}%· · {weightDown.toFixed(0)}%↓
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-bull" style={{ width: `${weightUp}%` }} />
          <div className="bg-muted-foreground/30" style={{ width: `${weightFlat}%` }} />
          <div className="bg-bear" style={{ width: `${weightDown}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>By Nifty weight</span>
        <span className="normal-case tracking-normal">
          {weightUp.toFixed(0)}%↑ · {weightFlat.toFixed(0)}%· · {weightDown.toFixed(0)}%↓
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <div
            key={s.symbol}
            className={`min-w-px ${
              s.side === "up" ? "bg-bull" : s.side === "down" ? "bg-bear" : "bg-muted-foreground/35"
            }`}
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

function BreadthHistoryTable({ rows }: { rows: NiftyBreadthHistoryRow[] }) {
  const display = rows.slice(0, 5);
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-3 text-[10px]">Time</TableHead>
            <TableHead className="text-[10px]">Wt adv %</TableHead>
            <TableHead className="text-[10px]">Wt dec %</TableHead>
            <TableHead className="pr-3 text-[10px]">Σ contrib</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {display.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="px-3 py-2 text-[11px] text-muted-foreground">
                Building 5‑min history… refresh keeps filling this.
              </TableCell>
            </TableRow>
          ) : (
            display.map((r) => (
              <TableRow key={r.bucketTs}>
                <TableCell className="pl-3 font-mono text-xs tabular-nums">{r.t}</TableCell>
                <TableCell className="font-mono text-xs tabular-nums text-bull">
                  {r.weightUp != null ? `${fmtNum(r.weightUp, 1)}%` : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums text-bear">
                  {r.weightDown != null ? `${fmtNum(r.weightDown, 1)}%` : "—"}
                </TableCell>
                <TableCell
                  className={`pr-3 font-mono text-xs tabular-nums ${pctClass(r.contributionPct)}`}
                >
                  {r.contributionPct != null
                    ? `${r.contributionPct >= 0 ? "+" : ""}${fmtNum(r.contributionPct, 3)}`
                    : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DriverRows({ rows }: { rows: NiftyBoardDriver[] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">No names yet.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li
          key={r.symbol}
          className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
        >
          <Link
            to="/stocks/$symbol"
            params={{ symbol: r.symbol }}
            className="font-mono text-xs font-semibold text-foreground hover:underline"
          >
            {r.symbol}
          </Link>
          <div className="shrink-0 text-right font-mono text-[11px] tabular-nums">
            <span className={pctClass(r.changePct)}>{fmtNum(r.changePct)}%</span>
            <span className="ml-2 text-muted-foreground">
              w{fmtNum(r.weight, 1)} · c{fmtNum(r.contributionPct, 3)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OiChart({ plot }: { plot: NiftyBoardPayload["optionOi"]["plot"] }) {
  if (!plot.length) {
    return <p className="px-1 py-3 text-xs text-muted-foreground">No OI plot data.</p>;
  }
  const tickFill = "var(--color-muted-foreground)";
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={plot} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <pattern id="hatchCe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="color-mix(in oklab, var(--color-bear) 18%, transparent)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-bear)" strokeWidth="2" strokeOpacity="0.55" />
            </pattern>
            <pattern id="hatchPe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="color-mix(in oklab, var(--color-bull) 18%, transparent)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-bull)" strokeWidth="2" strokeOpacity="0.55" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="strike"
            tick={{ fontSize: 9, fill: tickFill }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: tickFill }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={{ stroke: "var(--color-border)" }}
            width={36}
            tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.45 }}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--color-card-foreground)",
              boxShadow: "0 8px 24px color-mix(in oklab, var(--color-foreground) 12%, transparent)",
            }}
            labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: 4 }}
            itemStyle={{ color: "var(--color-card-foreground)" }}
            formatter={(value: number, name: string) => [fmtInt(value), name]}
            labelFormatter={(label) => `Strike ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: "var(--color-muted-foreground)" }}
          />
          <Bar dataKey="ceOi" name="CE now" stackId="ce" fill="var(--color-bear)" radius={[0, 0, 0, 0]} />
          <Bar
            dataKey="ceUnwind"
            name="CE unwound"
            stackId="ce"
            fill="url(#hatchCe)"
            radius={[2, 2, 0, 0]}
          />
          <Bar dataKey="peOi" name="PE now" stackId="pe" fill="var(--color-bull)" />
          <Bar
            dataKey="peUnwind"
            name="PE unwound"
            stackId="pe"
            fill="url(#hatchPe)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PcrMiniTable({ rows }: { rows: NiftyPcrHistoryRow[] }) {
  const display = rows.slice(0, 10);
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-3 text-[10px]">Time</TableHead>
            <TableHead className="text-[10px]">OI PCR</TableHead>
            <TableHead className="text-[10px]">Spot</TableHead>
            <TableHead className="pr-3 text-[10px]">Δ note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {display.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="px-3 py-2 text-[11px] text-muted-foreground">
                No PCR snapshots yet.
              </TableCell>
            </TableRow>
          ) : (
            display.map((r) => (
              <TableRow key={r.bucketTs}>
                <TableCell className="pl-3 font-mono text-xs tabular-nums">{r.t}</TableCell>
                <TableCell className="font-mono text-xs font-semibold tabular-nums">
                  {r.oiPcr != null ? r.oiPcr.toFixed(3) : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {r.spot != null ? fmtNum(r.spot, 1) : "—"}
                </TableCell>
                <TableCell className="max-w-[9rem] truncate pr-3 text-[10px] text-muted-foreground">
                  {r.insight || r.lean || "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function NiftyPage() {
  const q = useQuery({
    queryKey: NIFTY_QUERY_KEY,
    queryFn: () => fetchNiftyBoard(false),
    // No overnight polling — resume at 09:14 IST.
    refetchInterval: (query) => {
      const paused = query.state.data?.liveDataPaused;
      if (paused === true) return false;
      if (paused === false) return REFRESH_MS;
      return isLiveDataWindow() ? REFRESH_MS : false;
    },
    staleTime: 30_000,
    retry: 2,
  });

  const data = q.data;

  return (
    <div className="min-h-screen bg-background">
      <Header guide="dashboard" />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-6 sm:py-6">
        <div className="px-0.5">
          <h1 className="font-serif text-lg text-foreground">Market</h1>
          <p className="text-[11px] text-muted-foreground">
            Nifty 50 spot, breadth, OI / PCR, and basket sync
          </p>
        </div>

        {q.isLoading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : q.isError && !data ? (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-bear">
              {q.error instanceof Error ? q.error.message : "Failed to load Nifty board"}
            </CardContent>
          </Card>
        ) : data ? (
          <NiftyCards data={data} refreshing={q.isFetching} />
        ) : null}
      </main>
    </div>
  );
}

function NiftyCards({ data, refreshing }: { data: NiftyBoardPayload; refreshing: boolean }) {
  const idx = data.index;
  const br = data.breadth;
  const oi = data.optionOi;
  const pcr = data.pcr;
  const ll = data.leadLag;
  const insight = data.oiInsight;
  const [driverTab, setDriverTab] = useState("up");

  const weightUp = Number(br.weightUp ?? 0);
  const weightDown = Number(br.weightDown ?? 0);
  const weightFlat = Number(br.weightFlat ?? 0);

  return (
    <div className="flex flex-col gap-3">
      {refreshing ? (
        <p className="px-0.5 text-[10px] text-muted-foreground">Refreshing…</p>
      ) : null}

      {data.liveDataPaused || data.marketHours === false ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Live refresh paused after hours. Resumes {data.marketHoursLabel || LIVE_DATA_LABEL}. Showing last
          session snapshot.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Top: Spot + Futures + Breadth | Market sync */}
        <Card className="shadow-sm xl:col-span-2">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardTitle className="font-serif text-base font-normal">Nifty · breadth</CardTitle>
            <CardDescription className="text-[11px]">
              {br.quoteSource === "fyers" ? "Fyers live" : br.quoteSource || idx.source || "quotes"}
              {data.fyersConnected ? " · Fyers session on" : ""}
              {br.ready ? ` · ${br.quoted}/${br.universe}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Nifty spot
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                    {idx.ltp != null ? fmtNum(idx.ltp, 2) : "—"}
                  </span>
                  <span
                    className={`font-mono text-base font-semibold tabular-nums ${pctClass(idx.changePct)}`}
                  >
                    {idx.changePct != null
                      ? `${idx.changePct >= 0 ? "+" : ""}${fmtNum(idx.changePct)}%`
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Nifty futures
                  {data.futures?.expiryLabel ? ` · ${data.futures.expiryLabel}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                    {data.futures?.ltp != null ? fmtNum(data.futures.ltp, 2) : "—"}
                  </span>
                  <span
                    className={`font-mono text-base font-semibold tabular-nums ${pctClass(data.futures?.changePct)}`}
                  >
                    {data.futures?.changePct != null
                      ? `${data.futures.changePct >= 0 ? "+" : ""}${fmtNum(data.futures.changePct)}%`
                      : "—"}
                  </span>
                </div>
                {data.futures?.basisPts != null ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Basis {data.futures.basisPts >= 0 ? "+" : ""}
                    {fmtNum(data.futures.basisPts, 1)} pts
                    {data.futures.source ? ` · ${data.futures.source}` : ""}
                  </p>
                ) : data.futures && !data.futures.ready ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {data.futures.label || "Futures quote unavailable"}
                  </p>
                ) : null}
              </div>
            </div>

            {!br.ready ? (
              <p className="text-xs text-muted-foreground">{br.label || "Waiting for quotes…"}</p>
            ) : (
              <div className="space-y-3">
                <CountTape
                  advances={Number(br.advances ?? 0)}
                  declines={Number(br.declines ?? 0)}
                  unchanged={Number(br.unchanged ?? 0)}
                />
                <WeightTape
                  segments={br.segments ?? []}
                  weightUp={weightUp}
                  weightDown={weightDown}
                  weightFlat={weightFlat}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] leading-snug text-muted-foreground">{br.label}</p>
                  <span
                    className={`shrink-0 font-mono text-xs font-bold tabular-nums ${pctClass(br.contributionPct)}`}
                  >
                    {br.contributionPct != null
                      ? `${br.contributionPct >= 0 ? "+" : ""}${fmtNum(br.contributionPct, 2)} pts`
                      : ""}
                  </span>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Weighted A/D · 5‑min (5 rows)
                  </div>
                  <BreadthHistoryTable rows={data.breadthHistory ?? []} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market sync — right of top card */}
        <Card className="shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-serif text-base font-normal">Market sync</CardTitle>
              {(() => {
                const ms = data.marketSync;
                const v = syncVerdictChip(ms?.cross?.stance || ll.stance);
                return (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${v.className}`}
                  >
                    {ms?.cross?.verdict || v.label}
                  </span>
                );
              })()}
            </div>
            <CardDescription className="text-[11px]">
              Cash lead/lag vs FO · band ±{data.marketSync?.syncBandPp ?? ll.syncBandPp ?? 0.08}pp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-1">
            {(() => {
              const ms = data.marketSync;
              const band = ms?.syncBandPp ?? ll.syncBandPp ?? 0.08;
              const cash = ms?.cash;
              const fo = ms?.fo;
              const cross = ms?.cross;
              const fut = data.futures;

              return (
                <>
                  <SyncRow
                    title={cash?.label || "1 · Stocks basket vs Nifty"}
                    subtitle="Spot equities vs printed index"
                    leftLabel="Stocks basket"
                    leftValue={
                      cash?.basketMovePct != null
                        ? `${cash.basketMovePct >= 0 ? "+" : ""}${fmtNum(cash.basketMovePct, 3)}%`
                        : ll.basketMovePct != null
                          ? `${ll.basketMovePct >= 0 ? "+" : ""}${fmtNum(ll.basketMovePct, 3)}%`
                          : "—"
                    }
                    rightLabel="Nifty spot"
                    rightValue={
                      cash?.niftyMovePct != null
                        ? `${cash.niftyMovePct >= 0 ? "+" : ""}${fmtNum(cash.niftyMovePct, 3)}%`
                        : ll.indexMovePct != null
                          ? `${ll.indexMovePct >= 0 ? "+" : ""}${fmtNum(ll.indexMovePct, 3)}%`
                          : "—"
                    }
                    gapLabel="Nifty vs basket"
                    gapValue={formatGapPp(
                      cash?.niftyVsBasketPp ?? ll.indexVsBasketPp,
                      cash?.niftyVsBasketPts ?? ll.indexVsBasketPts,
                    )}
                    gapClass={niftyVsBasketClass(
                      cash?.niftyVsBasketPp ?? ll.indexVsBasketPp,
                      band,
                    )}
                    verdict={cash?.verdict}
                  />

                  <SyncRow
                    title={fo?.label || "2 · Stock futures vs Nifty futures"}
                    subtitle={
                      fo?.ready
                        ? `${fo.quoted ?? "—"}/${fo.universe ?? "—"} · ${fo.monthCode || "near month"}`
                        : fo?.note || "Needs Fyers for stock futures"
                    }
                    leftLabel="Stock-fut basket"
                    leftValue={
                      fo?.basketMovePct != null
                        ? `${fo.basketMovePct >= 0 ? "+" : ""}${fmtNum(fo.basketMovePct, 3)}%`
                        : "—"
                    }
                    rightLabel="Nifty futures"
                    rightValue={
                      fo?.niftyMovePct != null
                        ? `${fo.niftyMovePct >= 0 ? "+" : ""}${fmtNum(fo.niftyMovePct, 3)}%`
                        : fut?.changePct != null
                          ? `${fut.changePct >= 0 ? "+" : ""}${fmtNum(fut.changePct, 3)}%`
                          : "—"
                    }
                    gapLabel="Nifty fut vs stock-fut"
                    gapValue={formatGapPp(fo?.niftyVsBasketPp, fo?.niftyVsBasketPts)}
                    gapClass={niftyVsBasketClass(fo?.niftyVsBasketPp, band)}
                    verdict={fo?.verdict}
                  />

                  <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {cross?.label || "1 vs 2 · Cash − FO"}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-semibold ${
                          cross?.stance === "aligned"
                            ? "text-muted-foreground"
                            : cross?.stance === "cash_more_nifty_led"
                              ? "text-bull"
                              : cross?.stance === "fo_more_nifty_led"
                                ? "text-bear"
                                : "text-muted-foreground"
                        }`}
                      >
                        {cross?.verdict || "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">Difference</span>
                      <span
                        className={`font-mono text-lg font-semibold tabular-nums ${
                          cross?.diffPp == null || Math.abs(cross.diffPp) < band
                            ? "text-muted-foreground"
                            : cross.diffPp > 0
                              ? "text-bull"
                              : "text-bear"
                        }`}
                      >
                        {cross?.diffPp != null
                          ? `${cross.diffPp >= 0 ? "+" : ""}${fmtNum(cross.diffPp, 3)}pp`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] leading-snug text-foreground/90">
                    {ms?.insight || ll.syncInsight || "Building sync read…"}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* OI & PCR */}
        <Card className="shadow-sm xl:col-span-2">
          <CardHeader className="space-y-1 p-4 pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-serif text-base font-normal">OI & PCR</CardTitle>
              {(() => {
                const v = oiVerdict(insight?.sentiment);
                return (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${v.className}`}
                  >
                    {v.label}
                  </span>
                );
              })()}
            </div>
            <CardDescription className="text-[11px]">
              {oi.ready
                ? `ATM ${oi.atmStrike ?? "—"} · ${oi.expiry || "nearest"}`
                : "Waiting for option chain…"}
              {oi.source ? ` · ${oi.source}` : ""}
              {insight?.source ? ` · insight: ${insight.source}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-1">
            <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                OI insight
              </div>
              <p className={`mt-1 text-sm leading-snug ${sentimentClass(insight?.sentiment)}`}>
                {insight?.headline || data.insights?.[0] || "Building OI read…"}
              </p>
              {(insight?.bullets?.length ? insight.bullets : []).slice(0, 2).map((b, i) => (
                <p key={i} className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {b}
                </p>
              ))}
            </div>

            <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  OI PCR{pcr.expiry ? ` · ${pcr.expiry}` : ""}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{pcr.label || "—"}</p>
              </div>
              <span className={`font-mono text-xl font-semibold tabular-nums ${sentimentClass(pcr.lean)}`}>
                {pcr.ready && pcr.oiPcr != null ? pcr.oiPcr.toFixed(3) : "—"}
              </span>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ATM ±15 OI · hatched = unwound from day peak
              </div>
              <OiChart plot={oi.plot ?? []} />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Wing ΔOI · CE {fmtInt(oi.ceOiChgWing)} · PE {fmtInt(oi.peOiChgWing)}
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                PCR history · 5‑min
              </div>
              <PcrMiniTable rows={data.pcrHistory ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Top drivers — next to OI */}
        <Card className="shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardTitle className="font-serif text-base font-normal">Top drivers</CardTitle>
            <CardDescription className="text-[11px]">
              Heaviest by index weight · day move & contribution
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <Tabs value={driverTab} onValueChange={setDriverTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="up">Advances</TabsTrigger>
                <TabsTrigger value="down">Declines</TabsTrigger>
              </TabsList>
              <TabsContent value="up" className="mt-3">
                <DriverRows rows={data.drivers.topUp} />
              </TabsContent>
              <TabsContent value="down" className="mt-3">
                <DriverRows rows={data.drivers.topDown} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <p className="px-0.5 pb-6 text-[10px] text-muted-foreground">
        As of {new Date(data.asOf).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
        {data.cached ? " · cached" : ""}
      </p>
    </div>
  );
}
