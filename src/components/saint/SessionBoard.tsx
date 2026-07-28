import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Bookmark } from "lucide-react";
import type { SessionBuckets, StockRow, ThesisHealth } from "@/lib/market-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchStockDetail } from "@/lib/api";
import {
  sortBookmarkedFirst,
  useBookmarkStorageSync,
  useBookmarks,
} from "@/lib/bookmarks";
import {
  primarySignal,
  signalBarClass,
  signalSurface,
  signalTextClass,
  signalTier,
} from "@/lib/signal";
import { useIsMobile } from "@/lib/use-mobile";

const OVERNIGHT_PHASES = new Set(["before_open", "closed_day", "after_close"]);

type PanelMeta = { title: string; blurb: string; empty: string; sortHint: string };

const PANEL = {
  pinned: {
    title: "Pinned",
    blurb: "Your bookmarks — stay on top even if conviction drops off the board",
    empty: "Bookmark a stock to keep it here for exit monitoring.",
    sortHint: "Pinned first · stays visible after it leaves Live",
  },
  overnight: {
    title: "Overnight calls",
    blurb: "After-hours / pre-open news — check if the open is reacting",
    empty: "No overnight calls for this session.",
    sortHint: "Sorted by conviction (high → low) · bookmarks float to top",
  },
  next_session: {
    title: "Next market session",
    blurb: "Overnight / after-hours — may move the next open",
    empty: "Nothing queued for a future session yet.",
    sortHint: "Sorted by conviction (high → low) · bookmarks float to top",
  },
  fresh: {
    title: "Fresh this session",
    blurb: "Headlines published after today’s 9:15 open",
    empty: "No fresh cash-session headlines yet.",
    sortHint: "Sorted by conviction, then newest · bookmarks float to top",
  },
  live_session: {
    title: "Happening now",
    blurb: "Released while the market is open",
    empty: "Nothing new during this session yet.",
    sortHint: "Sorted by conviction, then newest · bookmarks float to top",
  },
  already_reacted: {
    title: "Already reacted",
    blurb: "Price has already moved with (or against) the story",
    empty: "No confirmed reactions yet.",
    sortHint: "Sorted by newest reaction first · bookmarks float to top",
  },
  past_watching: {
    title: "Still watching",
    blurb: "Reacted, but path or conviction still worth monitoring",
    empty: "Nothing still active in Past right now.",
    sortHint: "High conv · confirming/fading thesis · bookmarks first",
  },
  past_settled: {
    title: "Settled",
    blurb: "Move already played out — priced in, invalidated, or low evidence",
    empty: "No settled reactions yet.",
    sortHint: "Newest first · lower priority for attention",
  },
} as const satisfies Record<string, PanelMeta>;

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function timeAgo(m?: number | null) {
  if (m == null || m >= 9000) return "time n/a";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m ago` : `${h}h ago`;
}

function thesisClass(h?: ThesisHealth | null) {
  if (h === "confirming") return "bg-bull-soft text-bull ring-1 ring-bull/40";
  if (h === "fading") return "bg-gold-soft text-gold ring-1 ring-gold/35";
  if (h === "invalidated") return "bg-bear-soft text-bear ring-1 ring-bear/40";
  if (h === "cooling" || h === "pending") return "bg-muted text-muted-foreground ring-1 ring-border";
  return "";
}

function outcomeClass(status?: string) {
  if (status === "confirmed") return "text-bull";
  if (status === "wrong") return "text-bear";
  return "text-muted-foreground";
}

function isOvernightOrigin(s: StockRow) {
  return OVERNIGHT_PHASES.has(s.sessionPhase ?? "");
}

function byConviction(a: StockRow, b: StockRow) {
  return (
    (b.conviction ?? 0) - (a.conviction ?? 0) ||
    (b.impact ?? 0) - (a.impact ?? 0) ||
    (a.latestNewsMins ?? 9999) - (b.latestNewsMins ?? 9999)
  );
}

function byNewest(a: StockRow, b: StockRow) {
  return (a.latestNewsMins ?? 9999) - (b.latestNewsMins ?? 9999) || byConviction(a, b);
}

/** Past tab: still worth attention vs done for now. */
function stillWorthWatching(s: StockRow, bookmarked: Set<string>): boolean {
  if (bookmarked.has(s.symbol)) return true;
  const thesis = s.thesisHealth;
  if (thesis === "invalidated") return false;
  if (s.action === "already priced" || s.action === "already fallen") return false;
  if (s.outcome?.status === "wrong") return false;
  if (thesis === "confirming" || thesis === "fading") return true;
  if ((s.conviction ?? 0) >= 60) return true;
  if ((s.conviction ?? 0) >= 40 && (thesis === "cooling" || thesis === "pending")) return true;
  if (s.action === "buy long" || s.action === "buy short" || s.action === "buy" || s.action === "short") {
    return true;
  }
  return false;
}

function splitPast(reacted: StockRow[], bookmarks: string[]) {
  const pinned = new Set(bookmarks);
  const watching: StockRow[] = [];
  const settled: StockRow[] = [];
  for (const s of reacted) {
    if (stillWorthWatching(s, pinned)) watching.push(s);
    else settled.push(s);
  }
  watching.sort(byConviction);
  settled.sort(byNewest);
  return { watching, settled };
}

function BookmarkButton({
  symbol,
  bookmarked,
  onToggle,
}: {
  symbol: string;
  bookmarked: boolean;
  onToggle: (symbol: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={bookmarked ? `Unpin ${symbol}` : `Pin ${symbol}`}
      title={bookmarked ? "Unpin — remove from Pinned" : "Pin — keep on top for monitoring"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(symbol);
      }}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${
        bookmarked
          ? "border-gold/50 bg-gold-soft text-gold"
          : "border-border bg-card text-muted-foreground hover:border-gold/40 hover:text-gold"
      }`}
    >
      <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-current" : ""}`} />
    </button>
  );
}

function SessionCard({
  s,
  bookmarked,
  onToggleBookmark,
  offBoard,
}: {
  s: StockRow;
  bookmarked: boolean;
  onToggleBookmark: (symbol: string) => void;
  offBoard?: boolean;
}) {
  const up = s.changePct >= 0;
  const move = s.observedMovePct ?? s.moveSinceNewsPct;
  const moveUp = move != null && move >= 0;
  const tier = signalTier(s.conviction, s.signalTier);
  const signal = primarySignal(s);

  return (
    <Link
      to="/stocks/$symbol"
      params={{ symbol: s.symbol }}
      className={`group block border-b border-border/70 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-accent/40 sm:px-5 sm:py-3 ${
        bookmarked ? "bg-gold-soft/25" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BookmarkButton symbol={s.symbol} bookmarked={bookmarked} onToggle={onToggleBookmark} />
            <h3 className="font-semibold text-foreground group-hover:text-gold">{s.symbol}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${signalSurface(tier, { ring: false })}`}
              title={s.themeConflict ? "Opposing themes — treat as watch" : undefined}
            >
              {signal}
            </span>
            {offBoard ? (
              <span
                className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                title="No longer on the Live board — still pinned for you"
              >
                Off board
              </span>
            ) : null}
            {s.thesisHealth && s.thesisHealth !== "na" ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${thesisClass(s.thesisHealth)}`}
                title={s.thesisLabel ?? undefined}
              >
                {s.thesisHealth}
              </span>
            ) : null}
            {s.openCallLocked ? (
              <span
                className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                title="Overnight call locked at 09:15"
              >
                Locked
              </span>
            ) : s.sessionPhase && ["before_open", "after_close", "closed_day"].includes(s.sessionPhase) ? (
              <span
                className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                title="Bias and conviction can still change until 09:15"
              >
                Revising
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
            ₹{fmt(s.ltp)}
          </div>
          <div
            className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? "+" : ""}
            {s.changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-foreground">
        {s.anchorHeadline || "Linked market story"}
      </p>

      {s.conviction != null ? (
        <div className="mt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Conviction
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${signalTextClass(tier)}`}>
              {s.confidence ?? "low"}
            </span>
            <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-foreground">
              {s.conviction}/100
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${signalBarClass(tier)}`}
              style={{ width: `${Math.max(0, Math.min(100, s.conviction))}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{timeAgo(s.anchorMinutesAgo ?? s.latestNewsMins)}</span>
        {move != null ? (
          <span className={`font-mono normal-case tracking-normal ${moveUp ? "text-bull" : "text-bear"}`}>
            {moveUp ? "+" : ""}
            {move.toFixed(2)}% since news
          </span>
        ) : (
          <span>Move pending</span>
        )}
        {s.outcome?.label ? (
          <span className={`normal-case tracking-normal ${outcomeClass(s.outcome.status)}`}>
            {s.outcome.label}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function BucketPanel({
  stocks,
  meta,
  bookmarked,
  onToggleBookmark,
  offBoardSymbols,
  /** Natural height for accordion / mobile — no flex fill. */
  natural,
  hideHeader,
}: {
  stocks: StockRow[];
  meta: PanelMeta;
  bookmarked: string[];
  onToggleBookmark: (symbol: string) => void;
  offBoardSymbols?: Set<string>;
  natural?: boolean;
  hideHeader?: boolean;
}) {
  const ordered = sortBookmarkedFirst(stocks, bookmarked);
  return (
    <div
      className={
        natural
          ? "overflow-hidden rounded-xl border border-border bg-card"
          : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card"
      }
    >
      {!hideHeader ? (
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h3 className="font-serif text-lg text-foreground">{meta.title}</h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {stocks.length} stock{stocks.length === 1 ? "" : "s"} · {meta.blurb}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground/80">{meta.sortHint}</p>
        </div>
      ) : null}
      <div className={natural ? "max-h-[55vh] overflow-y-auto" : "flex-1 overflow-y-auto"}>
        {ordered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">{meta.empty}</div>
        ) : (
          ordered.map((s) => (
            <SessionCard
              key={`${s.symbol}-${s.anchorId || s.symbol}`}
              s={s}
              bookmarked={bookmarked.includes(s.symbol)}
              onToggleBookmark={onToggleBookmark}
              offBoard={offBoardSymbols?.has(s.symbol)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MobileBoardAccordion({
  value,
  title,
  count,
  blurb,
  children,
  defaultOpen,
}: {
  value: string;
  title: string;
  count: number;
  blurb: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Accordion type="multiple" defaultValue={defaultOpen ? [value] : []} className="w-full">
      <AccordionItem value={value} className="overflow-hidden rounded-xl border border-border bg-card px-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="min-w-0 flex-1 pr-2 text-left">
            <div className="font-serif text-base text-foreground">
              {title}
              <span className="ml-1.5 font-sans text-xs font-medium text-muted-foreground">({count})</span>
            </div>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {blurb}
            </p>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t border-border pb-0 pt-0">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function usePinnedRows(bookmarks: string[], boardBySymbol: Map<string, StockRow>) {
  const [fetched, setFetched] = useState<Record<string, StockRow>>({});

  const missing = useMemo(
    () => bookmarks.filter((s) => !boardBySymbol.has(s) && !fetched[s]),
    [bookmarks, boardBySymbol, fetched],
  );

  useEffect(() => {
    let cancelled = false;
    if (!missing.length) return;
    void (async () => {
      const results = await Promise.all(
        missing.map(async (sym) => {
          try {
            const detail = await fetchStockDetail(sym);
            return [sym, detail.stock] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setFetched((prev) => {
        const next = { ...prev };
        for (const row of results) {
          if (row) next[row[0]] = row[1];
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [missing.join("|")]);

  useEffect(() => {
    setFetched((prev) => {
      const keep = new Set(bookmarks);
      let changed = false;
      const next: Record<string, StockRow> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (keep.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [bookmarks]);

  return useMemo(() => {
    const rows: StockRow[] = [];
    const offBoard = new Set<string>();
    for (const sym of bookmarks) {
      const onBoard = boardBySymbol.get(sym);
      if (onBoard) {
        rows.push(onBoard);
      } else if (fetched[sym]) {
        rows.push(fetched[sym]);
        offBoard.add(sym);
      }
    }
    return { rows, offBoard };
  }, [bookmarks, boardBySymbol, fetched]);
}

export function SessionBoard({
  buckets,
  marketOpen,
}: {
  buckets: SessionBuckets;
  marketOpen?: boolean;
}) {
  useBookmarkStorageSync();
  const { symbols: bookmarks, toggle } = useBookmarks();
  const isMobile = useIsMobile();

  const next = buckets.next_session ?? [];
  const live = buckets.live_session ?? [];
  const reacted = buckets.already_reacted ?? [];
  const defaultBoard = "live";

  const overnightOpen = [...next, ...live].filter(isOvernightOrigin).sort(byConviction);
  const freshOpen = live.filter((s) => s.sessionPhase === "during_market").sort(byConviction);
  const liveCount = marketOpen ? overnightOpen.length + freshOpen.length : next.length + live.length;
  const { watching: pastWatching, settled: pastSettled } = useMemo(
    () => splitPast(reacted, bookmarks),
    [reacted, bookmarks],
  );

  const boardBySymbol = useMemo(() => {
    const map = new Map<string, StockRow>();
    for (const s of [...next, ...live, ...reacted, ...overnightOpen, ...freshOpen]) {
      if (!map.has(s.symbol)) map.set(s.symbol, s);
    }
    return map;
  }, [next, live, reacted, overnightOpen, freshOpen]);

  const { rows: pinnedRows, offBoard } = usePinnedRows(bookmarks, boardBySymbol);

  const primaryLive = marketOpen ? overnightOpen : next;
  const primaryMeta = marketOpen ? PANEL.overnight : PANEL.next_session;
  const secondaryLive = marketOpen ? freshOpen : live;
  const secondaryMeta = marketOpen ? PANEL.fresh : PANEL.live_session;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs defaultValue={defaultBoard} className="flex h-full min-h-0 flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-auto gap-1 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="live" className="rounded-lg px-4 text-xs sm:text-sm">
              Live
              <span className="ml-1.5 text-muted-foreground">({liveCount})</span>
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-lg px-4 text-xs sm:text-sm">
              Past
              <span className="ml-1.5 text-muted-foreground">({reacted.length})</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3">
            {bookmarks.length ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
                <Bookmark className="h-3 w-3 fill-current" />
                {bookmarks.length} pinned
              </span>
            ) : null}
            {marketOpen ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bull">
                <span className="live-dot" /> Live session
              </span>
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Market closed
              </span>
            )}
          </div>
        </div>

        <TabsContent value="live" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          {isMobile ? (
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-2">
              {bookmarks.length ? (
                <MobileBoardAccordion
                  value="pinned"
                  title={PANEL.pinned.title}
                  count={pinnedRows.length}
                  blurb="Tap to monitor exits"
                  defaultOpen
                >
                  <BucketPanel
                    stocks={pinnedRows}
                    meta={PANEL.pinned}
                    bookmarked={bookmarks}
                    onToggleBookmark={toggle}
                    offBoardSymbols={offBoard}
                    natural
                    hideHeader
                  />
                </MobileBoardAccordion>
              ) : null}
              <BucketPanel
                stocks={primaryLive}
                meta={primaryMeta}
                bookmarked={bookmarks}
                onToggleBookmark={toggle}
                natural
              />
              <MobileBoardAccordion
                value="secondary"
                title={secondaryMeta.title}
                count={secondaryLive.length}
                blurb={secondaryMeta.blurb}
              >
                <BucketPanel
                  stocks={secondaryLive}
                  meta={secondaryMeta}
                  bookmarked={bookmarks}
                  onToggleBookmark={toggle}
                  natural
                  hideHeader
                />
              </MobileBoardAccordion>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-3 lg:gap-4">
              {bookmarks.length ? (
                <div className="max-h-[40%] min-h-[120px] shrink-0 lg:max-h-[32%]">
                  <BucketPanel
                    stocks={pinnedRows}
                    meta={PANEL.pinned}
                    bookmarked={bookmarks}
                    onToggleBookmark={toggle}
                    offBoardSymbols={offBoard}
                  />
                </div>
              ) : null}
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                <BucketPanel
                  stocks={primaryLive}
                  meta={primaryMeta}
                  bookmarked={bookmarks}
                  onToggleBookmark={toggle}
                />
                <BucketPanel
                  stocks={secondaryLive}
                  meta={secondaryMeta}
                  bookmarked={bookmarks}
                  onToggleBookmark={toggle}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          {isMobile ? (
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-2">
              <BucketPanel
                stocks={pastWatching}
                meta={PANEL.past_watching}
                bookmarked={bookmarks}
                onToggleBookmark={toggle}
                natural
              />
              <MobileBoardAccordion
                value="settled"
                title={PANEL.past_settled.title}
                count={pastSettled.length}
                blurb={PANEL.past_settled.blurb}
              >
                <BucketPanel
                  stocks={pastSettled}
                  meta={PANEL.past_settled}
                  bookmarked={bookmarks}
                  onToggleBookmark={toggle}
                  natural
                  hideHeader
                />
              </MobileBoardAccordion>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-3 lg:gap-4">
              <div className="min-h-0 flex-[1.15]">
                <BucketPanel
                  stocks={pastWatching}
                  meta={PANEL.past_watching}
                  bookmarked={bookmarks}
                  onToggleBookmark={toggle}
                />
              </div>
              <div className="min-h-0 flex-1">
                <BucketPanel
                  stocks={pastSettled}
                  meta={PANEL.past_settled}
                  bookmarked={bookmarks}
                  onToggleBookmark={toggle}
                />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
