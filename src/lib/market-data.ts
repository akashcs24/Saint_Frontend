/** Shared domain types for Saint. No fixture market data lives here. */

export type ActionHint =
  | "buy long"
  | "buy short"
  | "watch"
  | "already priced"
  | "already fallen"
  // Legacy values still accepted from older payloads
  | "buy"
  | "short"
  | "avoid";
export type SentimentBias = "bullish" | "bearish" | "mixed";
export type SignalTier = "strong" | "medium" | "weak";
export type SentimentLabel = "Positive" | "Negative" | "Neutral";
export type PlainSentiment = "Positive" | "Negative" | "Unclear";
export type DirectionHint = "up" | "down" | "unclear";
export type IndexKey = "NIFTY" | "BANKNIFTY" | "SENSEX" | string;
export type MacroScope =
  | "commodity"
  | "macro"
  | "geopolitics"
  | "flows"
  | "currency"
  | "monetary"
  | "policy"
  | "global"
  | "weather"
  | "crypto";
/** How a story reaches a stock. Only `direct` is company news. */
export type LinkType = "direct" | "peer" | "sector" | "index";
export type NewsScope = "company" | "sector" | "market" | "offshore" | "unclassified";
export type ConfidenceLabel = "high" | "medium" | "low";
export type SessionPhase = "before_open" | "during_market" | "after_close" | "closed_day";
export type ReactionBucket = "next_session" | "live_session" | "already_reacted";
export type OutcomeStatus = "pending" | "confirmed" | "wrong" | "flat";
export type ThesisHealth =
  | "confirming"
  | "fading"
  | "invalidated"
  | "cooling"
  | "pending"
  | "na";

export interface IndexQuote {
  key: IndexKey;
  name: string;
  ltp: number;
  change: number;
  changePct: number;
  asOf?: string;
  source?: string;
}

export interface PredictionOutcome {
  status: OutcomeStatus;
  label: string;
  movePct?: number | null;
  openMovePct?: number | null;
  openPlusMovePct?: number | null;
  closeMovePct?: number | null;
  scorer?: string | null;
}

export interface SessionInfo {
  tz: string;
  now: string;
  open: boolean;
  /** 09:15–09:45 IST — faster quote/refresh window for overnight gap checks. */
  openWindow?: boolean;
  quoteTtlS?: number;
  /** Suggested frontend poll interval while this session snapshot is live. */
  refreshHintMs?: number;
  phase: SessionPhase;
  nextOpen: string;
  priorClose: string;
  tradingDay: boolean;
}

export interface AccuracySlice {
  resolved: number;
  confirmed: number;
  wrong: number;
  flat: number;
  decided?: number;
  hitRate: number | null;
  ready?: boolean;
}

export interface AccuracySummary {
  resolved: number;
  confirmed: number;
  wrong: number;
  flat: number;
  hitRate: number | null;
  ready: boolean;
  slices?: {
    overall?: AccuracySlice;
    atOpen?: AccuracySlice;
    atClose?: AccuracySlice;
    highConviction?: AccuracySlice;
    midConviction?: AccuracySlice;
    direct?: AccuracySlice;
    sector?: AccuracySlice;
  };
}

export interface NiftyBreadthMover {
  symbol: string;
  changePct: number;
  weight: number;
  contributionPct: number;
}

export interface NiftyBreadthSegment {
  symbol: string;
  changePct: number;
  weight: number;
  contributionPct: number;
  side: "up" | "down" | "flat";
}

export interface TrendArrows {
  /** vs ~5 minutes ago */
  m5: "up" | "down" | "flat" | null;
  /** vs ~15 minutes ago */
  m15: "up" | "down" | "flat" | null;
}

export interface NiftyPcr {
  ready: boolean;
  oiPcr: number;
  volumePcr: number | null;
  putOi: number;
  callOi: number;
  lean: "bullish" | "bearish" | "mild_bullish" | "mild_bearish" | "neutral" | string;
  label: string;
  expiry?: string | null;
  asOf?: string | null;
  source?: string;
  /** 1st arrow = 5m, 2nd = 15m (PCR rising/falling). */
  trend?: TrendArrows | null;
}

export interface NiftyBreadth {
  ready: boolean;
  advances: number;
  declines: number;
  unchanged: number;
  quoted: number;
  universe: number;
  weightUp: number;
  weightDown: number;
  weightFlat: number;
  contributionPct: number | null;
  lean: "bullish" | "bearish" | "mixed" | "unclear";
  action: "buy long" | "buy short" | "watch" | string;
  label: string;
  topUp: NiftyBreadthMover[];
  topDown: NiftyBreadthMover[];
  /** Per-name weight tape: width = index weight, colour = day side. */
  segments?: NiftyBreadthSegment[];
  /** Nearest-expiry Nifty put/call ratio (OI primary). */
  pcr?: NiftyPcr | null;
  /** Where constituent weights came from (auto scrape vs fallback). */
  weightsMeta?: {
    source?: string;
    count?: number;
    fetchedAt?: string;
    unmapped?: string[];
  } | null;
  /** Decline/advance weight % vs 5m and 15m ago. */
  weightTrend?: {
    down?: TrendArrows | null;
    up?: TrendArrows | null;
  } | null;
}

export interface StockRow {
  symbol: string;
  name: string;
  index: IndexKey;
  ltp: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  /** Stories naming the company itself. */
  newsCount: number;
  /** Sector/macro stories linked as context rather than company news. */
  contextCount?: number;
  /** Minutes since the freshest company headline (for time-first ranking). */
  latestNewsMins?: number;
  sentiment: SentimentLabel;
  plainSentiment?: PlainSentiment;
  impact: number;
  bias: SentimentBias;
  action: ActionHint;
  actionNote?: string | null;
  moveSinceNewsPct?: number | null;
  /** Evidence strength behind the read, 0–100. */
  conviction?: number;
  confidence?: ConfidenceLabel;
  convictionDrivers?: string[];
  /** green ≥60 / gold 40–59 / grey <40 — signal visuals, never red. */
  signalTier?: SignalTier;
  themeConflict?: boolean;
  expectedDirection?: number;
  direction?: DirectionHint;
  bucket?: ReactionBucket;
  sessionPhase?: SessionPhase;
  targetSession?: string;
  baselinePrice?: number | null;
  baselineLabel?: string | null;
  observedMovePct?: number | null;
  anchorHeadline?: string | null;
  anchorReason?: string | null;
  anchorId?: string | null;
  anchorPublishedAt?: string | null;
  anchorMinutesAgo?: number | null;
  anchorLinkType?: LinkType | null;
  outcome?: PredictionOutcome | null;
  /** Overnight call behaviour during cash hours (not a watchlist). */
  thesisHealth?: ThesisHealth | null;
  thesisLabel?: string | null;
  thesisGapState?: string | null;
  thesisHoldState?: string | null;
  thesisOpenMovePct?: number | null;
  thesisPlus15MovePct?: number | null;
  thesisPlus30MovePct?: number | null;
  thesisLastMovePct?: number | null;
  thesisPeakFavPct?: number | null;
  thesisGivebackFrac?: number | null;
  thesisTrailDropPct?: number | null;
  thesisExitTrigger?: string | null;
  thesisSessionHighPct?: number | null;
  thesisSessionLowPct?: number | null;
  openCallLocked?: boolean | null;
  openCallRevisedAt?: string | null;
  openCallFrozenAt?: string | null;
  nearestResistance?: number | null;
  nearestSupport?: number | null;
  distResistPct?: number | null;
  distSupportPct?: number | null;
  sessionVwap?: number | null;
  distVwapPct?: number | null;
  breakoutLong?: boolean | null;
  /** Saint's own sector bucket, used for read-across. */
  sectorGroup?: string;
  sector: string;
  marketCap: string;
  dayRange: [number, number] | number[];
  yearRange: [number, number] | number[];
  peRatio: number | null;
  about: string;
  quoteSource?: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url?: string;
  minutesAgo: number;
  publishedAt?: string | null;
  chartDate?: string | null;
  sentiment: SentimentLabel;
  impact: number;
  /** Symbols the story names directly. */
  tickers: string[];
  credibility?: number;
  kind?: "news" | "tweet";
  tags?: string[];
  /** Macro themes detected in the story, e.g. "Crude oil", "RBI policy". */
  themeLabels?: string[];
  scope?: NewsScope;
  /** Set when the story was fetched in the context of one symbol. */
  relevance?: number;
  linkType?: LinkType;
  linkReason?: string;
  /** +1 tailwind, -1 headwind, 0 unresolved. */
  expectedDirection?: number;
}

export interface MacroCard {
  id: string;
  title: string;
  detail: string;
  scope: MacroScope;
  theme?: string;
  sentiment: SentimentLabel;
  impact: number;
  instruments: string[];
  minutesAgo: number;
  source: string;
}

export interface MorningBriefData {
  generatedAt: string;
  headline: string;
  bullets: string[];
}

export interface SessionBuckets {
  next_session: StockRow[];
  live_session: StockRow[];
  already_reacted: StockRow[];
}
