import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
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
  fetchNiftyPaperTrades,
  NIFTY_PAPER_QUERY_KEY,
  tickNiftyPaperTrades,
  type NiftyPaperBucket,
  type NiftyPaperTradeRow,
  type NiftyPaperWallet,
} from "@/lib/api";
import { isLiveDataWindow } from "@/lib/market-hours";

function fmtNum(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtRs(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}₹${fmtNum(n, digits)}`;
}

function fmtTs(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return iso;
  }
}

function pnlClass(n?: number | null) {
  if (n == null || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-bull" : "text-bear";
}

const FYERS_PAPER_REFRESH_MS = 2_000;

export function NiftyPaperTradePanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: NIFTY_PAPER_QUERY_KEY,
    queryFn: () => fetchNiftyPaperTrades(isLiveDataWindow()),
    refetchInterval: () => (isLiveDataWindow() ? FYERS_PAPER_REFRESH_MS : false),
    staleTime: 1_000,
    placeholderData: (prev) => prev,
  });

  const tick = useMutation({
    mutationFn: () => tickNiftyPaperTrades(true),
    onSuccess: (data) => {
      if (data.buckets) {
        qc.setQueryData(NIFTY_PAPER_QUERY_KEY, {
          strategies: data.strategies,
          buckets: data.buckets,
          wallet: data.wallet,
          storage: data.storage,
          mongoReady: data.mongoReady,
        });
      } else {
        void qc.invalidateQueries({ queryKey: NIFTY_PAPER_QUERY_KEY });
      }
    },
  });

  const buckets = q.data?.buckets ?? [];
  const portfolio = q.data?.wallet;
  const strategyTabs = useMemo(() => {
    if (buckets.length) {
      return buckets.map((b) => ({
        id: b.strategyId,
        label: b.summary?.strategy?.label || b.strategyId,
      }));
    }
    return (q.data?.strategies ?? []).map((s) => ({ id: s.id, label: s.label }));
  }, [buckets, q.data?.strategies]);

  const [tab, setTab] = useState<string>("");
  const activeId = tab || strategyTabs[0]?.id || "decline";
  const active: NiftyPaperBucket | undefined =
    buckets.find((b) => b.strategyId === activeId) ?? buckets[0];

  const summary = active?.summary;
  const bookWallet = summary?.wallet;
  const trades = active?.trades ?? [];
  const open = summary?.open ?? trades.find((t) => t.status === "open") ?? null;
  const lastTick = tick.data;
  const quote = lastTick?.quote;
  const signal = q.data?.signal;
  const liveLtp = q.data?.liveLtp;
  const posLtp = liveLtp?.positions?.[activeId];
  const atmLtp = liveLtp?.atm;
  const bookCount = portfolio?.books ?? (strategyTabs.length || 3);

  return (
    <div className="flex flex-col gap-3">
      <WalletStrip
        title="Paper portfolio"
        subtitle={`${bookCount} books · ₹1L each · Mongo ${q.data?.mongoReady ? "on" : "off"}`}
        wallet={portfolio}
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
            <div className="space-y-1">
              <CardTitle className="font-serif text-base font-normal">Paper trade</CardTitle>
              <CardDescription className="max-w-xl text-[11px] leading-relaxed">
                Decline ×4 and SL/TSL enter on <strong>3 consecutive 5m weightUp increases</strong> — not
                adv/dec alone. Sync cross uses cross.diffPp. Each tab is its own ₹1L book.
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={() => tick.mutate()}
              disabled={tick.isPending}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {tick.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Tick now
            </button>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {strategyTabs.length > 0 ? (
              <Tabs value={activeId} onValueChange={setTab}>
                <TabsList
                  className="grid h-9 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(strategyTabs.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {strategyTabs.map((s) => (
                    <TabsTrigger key={s.id} value={s.id} className="text-xs">
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {strategyTabs.map((s) => {
                  const bucket = buckets.find((b) => b.strategyId === s.id);
                  const sm = bucket?.summary;
                  const w = sm?.wallet;
                  return (
                    <TabsContent key={s.id} value={s.id} className="mt-3 space-y-3">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Entry {sm?.strategy?.entry ?? "rising ×3"} · Exit{" "}
                        {sm?.strategy?.exit ?? "—"}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Stat
                          label="Book equity"
                          value={`₹${fmtNum(w?.equityRs ?? 100_000, 0)}`}
                          className={pnlClass((w?.equityRs ?? 100_000) - 100_000)}
                        />
                        <Stat
                          label="Return"
                          value={`${fmtNum(w?.returnPct ?? 0, 2)}%`}
                          className={pnlClass(w?.returnPct)}
                        />
                        <Stat
                          label="Realized P&L"
                          value={fmtRs(w?.realizedPnlRs ?? sm?.netPnlRs ?? 0, 0)}
                          className={pnlClass(w?.realizedPnlRs ?? sm?.netPnlRs)}
                        />
                        <Stat
                          label="Wins / Losses"
                          value={`${sm?.wins ?? 0} / ${sm?.losses ?? 0}`}
                        />
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : q.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading strategies…</p>
            ) : (
              <p className="text-xs text-muted-foreground">No strategies registered.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardTitle className="font-serif text-base font-normal">Live LTP</CardTitle>
            <CardDescription className="text-[11px]">
              {liveLtp?.source ?? atmLtp?.source ?? quote?.source ?? "Fyers · 2s refresh"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-1 text-xs">
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                ATM CE
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {fmtNum(atmLtp?.ltp ?? quote?.ltp)}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  strike {atmLtp?.strike ?? quote?.strike ?? "—"}
                </span>
              </div>
            </div>
            {open && posLtp ? (
              <div className="rounded-lg border border-bull/30 bg-bull/5 px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Open position · {open.strike ?? posLtp.strike ?? "—"}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {fmtNum(posLtp.ltp)}
                  </span>
                  <span className={`font-mono text-[11px] tabular-nums ${pnlClass(posLtp.pnlRs)}`}>
                    {posLtp.pnlRs != null ? fmtRs(posLtp.pnlRs, 0) : "—"}
                    {posLtp.pnlPct != null ? ` (${fmtNum(posLtp.pnlPct, 1)}%)` : ""}
                  </span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {posLtp.symbol ?? open.symbol}
                </div>
              </div>
            ) : open ? (
              <p className="text-[10px] text-muted-foreground">Position LTP loading…</p>
            ) : null}
            <div className="flex justify-between gap-2 border-t border-border/50 pt-2">
              <span className="text-muted-foreground">weightUp signal</span>
              <span className="font-mono text-[10px] tabular-nums">
                ↑3 {(lastTick?.rising3 ?? signal?.rising3) ? "yes" : "no"} · ↓4{" "}
                {(lastTick?.falling4 ?? signal?.falling4) ? "yes" : "no"}
              </span>
            </div>
            {signal?.weightUpSeries?.length ? (
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                5m weightUp: {signal.weightUpSeries.join(" → ")}
              </div>
            ) : null}
            {signal?.entryHint ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">{signal.entryHint}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {tick.isError ? (
        <p className="text-xs text-bear">
          {tick.error instanceof Error ? tick.error.message : "Tick failed"}
        </p>
      ) : null}

      {open ? (
        <Card className="border-bull/30 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-bull">
              Open · {summary?.strategy?.label ?? activeId}
            </CardTitle>
            <CardDescription className="text-[11px]">{open.entryReason}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 text-xs sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground">Symbol</div>
              <div className="font-mono font-semibold">{open.symbol}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Entry</div>
              <div className="font-mono tabular-nums">
                {fmtNum(open.entryPx)} · {fmtTs(open.entryTs)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Strike LTP</div>
              <div className="font-mono tabular-nums">
                {fmtNum(posLtp?.ltp ?? summary?.markLtp)}{" "}
                <span className="text-muted-foreground">· entry {fmtNum(open.entryPx)}</span>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Unrealized</div>
              <div className={`font-mono tabular-nums ${pnlClass(posLtp?.pnlRs ?? bookWallet?.unrealizedPnlRs)}`}>
                {fmtRs(posLtp?.pnlRs ?? bookWallet?.unrealizedPnlRs, 0)}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          No open trade in this bucket. UptimeRobot /health?tick=1 keeps Render awake and evaluates
          paper books during market hours after you paste Fyers auth.
        </p>
      )}

      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="font-serif text-base font-normal">
            Trade log · {summary?.strategy?.label ?? activeId}
          </CardTitle>
          <CardDescription className="text-[11px]">Mock fills at Fyers ATM CE LTP</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Entry</TableHead>
                  <TableHead className="text-[10px]">Exit</TableHead>
                  <TableHead className="text-[10px]">Strike</TableHead>
                  <TableHead className="text-[10px]">LTP</TableHead>
                  <TableHead className="text-[10px]">Px in→out</TableHead>
                  <TableHead className="text-[10px]">Margin</TableHead>
                  <TableHead className="pr-4 text-[10px]">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-6 text-xs text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-6 text-xs text-muted-foreground">
                      No paper trades in this bucket yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  trades.map((t) => <TradeRow key={t.id} t={t} />)
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WalletStrip({
  title,
  subtitle,
  wallet,
}: {
  title: string;
  subtitle: string;
  wallet?: NiftyPaperWallet;
}) {
  const books = wallet?.books ?? 3;
  const perBook = wallet?.startingCapitalRsPerBook ?? 100_000;
  const start = wallet?.startingCapitalRs ?? perBook * books;
  const equity = wallet?.equityRs ?? start;
  const pnl = (wallet?.realizedPnlRs ?? 0) + (wallet?.unrealizedPnlRs ?? 0);
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
        <div>
          <CardTitle className="font-serif text-base font-normal">{title}</CardTitle>
          <CardDescription className="text-[11px]">{subtitle}</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Equity
          </div>
          <div className={`font-mono text-lg font-semibold tabular-nums ${pnlClass(pnl)}`}>
            ₹{fmtNum(equity, 0)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 pt-1 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Starting" value={`₹${fmtNum(start, 0)}`} />
        <Stat
          label="Realized"
          value={fmtRs(wallet?.realizedPnlRs ?? 0, 0)}
          className={pnlClass(wallet?.realizedPnlRs)}
        />
        <Stat
          label="Unrealized"
          value={fmtRs(wallet?.unrealizedPnlRs ?? 0, 0)}
          className={pnlClass(wallet?.unrealizedPnlRs)}
        />
        <Stat label="Cash" value={`₹${fmtNum(wallet?.cashRs ?? start, 0)}`} />
        <Stat
          label="Return"
          value={`${fmtNum(wallet?.returnPct ?? 0, 2)}%`}
          className={pnlClass(wallet?.returnPct)}
        />
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${className}`}>{value}</div>
    </div>
  );
}

function TradeRow({ t }: { t: NiftyPaperTradeRow }) {
  return (
    <TableRow>
      <TableCell className="pl-4 text-[11px]">
        <span className={t.status === "open" ? "text-bull" : "text-muted-foreground"}>
          {t.status}
        </span>
      </TableCell>
      <TableCell className="max-w-[8rem] truncate font-mono text-[10px] tabular-nums">
        {fmtTs(t.entryTs)}
        <div className="truncate text-muted-foreground">{t.entryReason}</div>
      </TableCell>
      <TableCell className="max-w-[8rem] truncate font-mono text-[10px] tabular-nums">
        {fmtTs(t.exitTs)}
        <div className="truncate text-muted-foreground">{t.exitReason || "—"}</div>
      </TableCell>
      <TableCell className="font-mono text-[11px] tabular-nums">{t.strike ?? "—"}</TableCell>
      <TableCell className={`font-mono text-[11px] tabular-nums ${t.status === "open" ? pnlClass(t.markPnlRs) : ""}`}>
        {t.status === "open" ? fmtNum(t.markLtp) : "—"}
        {t.status === "open" && t.markPnlRs != null ? (
          <div className={`text-[10px] ${pnlClass(t.markPnlRs)}`}>{fmtRs(t.markPnlRs, 0)}</div>
        ) : null}
      </TableCell>
      <TableCell className="font-mono text-[11px] tabular-nums">
        {fmtNum(t.entryPx)}→{t.exitPx != null ? fmtNum(t.exitPx) : "—"}
      </TableCell>
      <TableCell className="font-mono text-[11px] tabular-nums">₹{fmtNum(t.marginRs, 0)}</TableCell>
      <TableCell className={`pr-4 font-mono text-[11px] font-semibold tabular-nums ${pnlClass(t.pnlRs)}`}>
        {t.pnlRs != null ? `₹${fmtNum(t.pnlRs, 0)}` : "—"}
        {t.pnlPct != null ? (
          <span className="ml-1 text-[10px] font-normal">({fmtNum(t.pnlPct, 1)}%)</span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
