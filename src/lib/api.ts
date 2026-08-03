/**
 * API client — backend only. No local fixture fallbacks.
 * Requires VITE_API_BASE_URL (see .env.local).
 */

import type {
  AccuracySummary,
  IndexQuote,
  MacroCard,
  MorningBriefData,
  NewsItem,
  NiftyBreadth,
  SessionBuckets,
  SessionInfo,
  StockRow,
} from "@/lib/market-data";

export type {
  AccuracySummary,
  ActionHint,
  ConfidenceLabel,
  DirectionHint,
  IndexQuote,
  LinkType,
  MacroCard,
  MorningBriefData,
  NewsItem,
  NewsScope,
  PlainSentiment,
  PredictionOutcome,
  ReactionBucket,
  SentimentBias,
  SentimentLabel,
  SessionBuckets,
  SessionInfo,
  SessionPhase,
  StockRow,
} from "@/lib/market-data";

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;

export interface DashboardPayload {
  asOf: string;
  session?: SessionInfo;
  indices: IndexQuote[];
  niftyBreadth?: NiftyBreadth | null;
  buckets?: SessionBuckets;
  topStocks: StockRow[];
  morningBrief: MorningBriefData;
  news: NewsItem[];
  macro: MacroCard[];
  accuracy?: AccuracySummary | null;
}

export interface StockDetailPayload {
  asOf: string;
  session?: SessionInfo;
  stock: StockRow;
  /** Company news — stories that name the business. Drives chart markers. */
  news: NewsItem[];
  /** Sector and macro read-through, shown separately from company news. */
  context?: NewsItem[];
}

export interface PriceSeriesPayload {
  symbol: string;
  range: string;
  source: string;
  interval?: string;
  points: {
    t: string;
    p: number;
    o?: number | null;
    h?: number | null;
    l?: number | null;
    v?: number | null;
  }[];
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function isApiConfigured(): boolean {
  return Boolean(API_BASE);
}

async function apiGet<T>(path: string, init?: RequestInit, timeoutMs = 120_000): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Start the backend and configure .env.local.");
  }
  const ctrl = new AbortController();
  const userSignal = init?.signal;
  const onAbort = () => ctrl.abort();
  if (userSignal) {
    if (userSignal.aborted) ctrl.abort();
    else userSignal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
    if (res.status === 404) {
      throw new Error("NOT_FOUND");
    }
    if (!res.ok) {
      throw new Error(`API ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "Server is waking or dashboard is still building (free Render can take 1–2 min). Wait and refresh.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    userSignal?.removeEventListener("abort", onAbort);
  }
}

export type ServerHealth = { ok: boolean };

/** Lightweight wake/ping — used by the header status light. */
export async function fetchHealth(timeoutMs = 45_000): Promise<ServerHealth> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await apiGet<ServerHealth>("/health", { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDashboard(force = false): Promise<DashboardPayload> {
  const q = force ? "?force=true" : "";
  // Cheap wake — ~0.5s when warm; starts free Render when cold.
  try {
    await fetchHealth(force ? 90_000 : 45_000);
  } catch {
    /* continue */
  }
  // Soft loads expect SWR cache (fast). Force still returns stale instantly on
  // server, but allow longer wait on true cold start.
  return apiGet<DashboardPayload>(`/api/dashboard${q}`, undefined, force ? 180_000 : 120_000);
}

export async function fetchStockDetail(symbol: string): Promise<StockDetailPayload> {
  return apiGet<StockDetailPayload>(`/api/stocks/${encodeURIComponent(symbol)}`);
}

export async function fetchPriceSeries(
  symbol: string,
  range = "1M",
): Promise<PriceSeriesPayload> {
  return apiGet<PriceSeriesPayload>(
    `/api/prices/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`,
  );
}

export type AiHelperVerdict =
  | "buy_now"
  | "wait_pullback"
  | "avoid_chase"
  | "short_now"
  | "stay_out"
  | "watch"
  | string;

export interface AiHelperResult {
  ready: boolean;
  verdict: AiHelperVerdict;
  timing?: "early" | "ok" | "late" | string;
  headline: string;
  setup?: string;
  bullets: string[];
  conflicts: string[];
  confidence: "low" | "medium" | "high" | string;
  model?: string;
  cached?: boolean;
  source?: string;
  dataSources?: {
    fundamentals?: string;
    technicals?: string;
    news?: string;
  };
  error?: string;
  message?: string;
}

/** On-demand OpenAI helper for one stock (grounded in Saint packet). */
export async function fetchAiHelper(symbol: string, force = false): Promise<AiHelperResult> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Start the backend and configure .env.local.");
  }
  const q = force ? "?force=true" : "";
  const res = await fetch(`${API_BASE}/api/stocks/${encodeURIComponent(symbol)}/ai-helper${q}`, {
    method: "POST",
  });
  if (res.status === 404) throw new Error("NOT_FOUND");
  const body = (await res.json().catch(() => ({}))) as AiHelperResult & { detail?: string };
  if (!res.ok) {
    throw new Error(body.detail || body.message || `AI helper failed: ${res.status}`);
  }
  return body;
}

export interface FyersStatus {
  configured: boolean;
  /** Token proven with Fyers (may still be after-hours with polling paused). */
  connected: boolean;
  /** Token on disk/memory — not sufficient alone for green. */
  hasToken?: boolean;
  marketHours?: boolean;
  marketHoursLabel?: string | null;
  /** Connected/token kept, but quote polling is paused until market hours. */
  pausedOutsideHours?: boolean;
  connectedAt?: string | null;
  appIdSuffix?: string | null;
  redirectUri?: string | null;
  lastError?: string | null;
  breadthSourceHint?: string | null;
  url?: string;
}

export async function fetchFyersStatus(): Promise<FyersStatus> {
  return apiGet<FyersStatus>("/api/fyers/status", undefined, 30_000);
}

export async function fetchFyersAuthUrl(): Promise<FyersStatus & { url: string }> {
  return apiGet<FyersStatus & { url: string }>("/api/fyers/auth-url", undefined, 30_000);
}

export async function exchangeFyersCode(code: string): Promise<FyersStatus> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const res = await fetch(`${API_BASE}/api/fyers/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = (await res.json().catch(() => ({}))) as FyersStatus & { detail?: string };
  if (!res.ok) {
    throw new Error(
      typeof body.detail === "string" ? body.detail : `Fyers exchange failed: ${res.status}`,
    );
  }
  return body;
}

export async function logoutFyers(): Promise<FyersStatus> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const res = await fetch(`${API_BASE}/api/fyers/logout`, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as FyersStatus & { detail?: string };
  if (!res.ok) {
    throw new Error(
      typeof body.detail === "string" ? body.detail : `Fyers logout failed: ${res.status}`,
    );
  }
  return body;
}

export const NIFTY_QUERY_KEY = ["nifty"] as const;

export interface NiftyBoardDriver {
  symbol: string;
  changePct: number;
  weight: number;
  contributionPct: number;
  side?: "up" | "down" | "flat";
}

export interface NiftyPcrHistoryRow {
  bucketTs: number;
  t: string;
  asOf?: string;
  oiPcr: number | null;
  volumePcr?: number | null;
  putOi?: number | null;
  callOi?: number | null;
  spot?: number | null;
  lean?: string | null;
  ceOiWing?: number | null;
  peOiWing?: number | null;
  ceOiChgWing?: number | null;
  peOiChgWing?: number | null;
  insight?: string | null;
}

export interface NiftyBreadthHistoryRow {
  bucketTs: number;
  t: string;
  asOf?: string;
  weightUp: number | null;
  weightDown: number | null;
  weightFlat?: number | null;
  contributionPct?: number | null;
  advances?: number | null;
  declines?: number | null;
  lean?: string | null;
}

export interface NiftyBoardPayload {
  asOf: string;
  fyersConnected?: boolean;
  cached?: boolean;
  marketHours?: boolean;
  marketHoursLabel?: string | null;
  liveDataPaused?: boolean;
  index: {
    ready: boolean;
    key?: string;
    name?: string;
    ltp: number | null;
    change?: number | null;
    changePct: number | null;
    previousClose?: number | null;
    volume?: number | null;
    source?: string | null;
  };
  breadth: {
    ready: boolean;
    advances?: number | null;
    declines?: number | null;
    unchanged?: number | null;
    quoted?: number | null;
    universe?: number | null;
    weightUp?: number | null;
    weightDown?: number | null;
    weightFlat?: number | null;
    contributionPct?: number | null;
    lean?: string | null;
    action?: string | null;
    label?: string | null;
    quoteSource?: string | null;
    segments?: {
      symbol: string;
      changePct: number;
      weight: number;
      contributionPct: number;
      side: "up" | "down" | "flat";
    }[];
    weightTrend?: {
      up?: { m5?: string | null; m15?: string | null };
      down?: { m5?: string | null; m15?: string | null };
    };
  };
  breadthHistory?: NiftyBreadthHistoryRow[];
  drivers: {
    topUp: NiftyBoardDriver[];
    topDown: NiftyBoardDriver[];
  };
  leadLag: {
    ready: boolean;
    baseline?: string;
    basketMovePct: number | null;
    indexMovePct: number | null;
    indexVsBasketPp?: number | null;
    indexVsBasketPts?: number | null;
    syncBandPp?: number | null;
    diffPp: number | null;
    stance?: string;
    verdict?: string;
    label: string;
    howToRead?: string;
    syncInsight?: string;
    note?: string;
  };
  futures?: {
    ready: boolean;
    symbol?: string;
    expiry?: string;
    expiryLabel?: string;
    ltp?: number | null;
    changePct?: number | null;
    source?: string | null;
    spot?: number | null;
    basisPts?: number | null;
    basisPct?: number | null;
    basisStance?: string;
    basisLabel?: string;
    fairValue?: number | null;
    vsFairPts?: number | null;
    fvStance?: string;
    fvLabel?: string;
    daysToExpiry?: number | null;
    label?: string;
  };
  stockFutBasket?: {
    ready: boolean;
    basketMovePct?: number | null;
    quoted?: number;
    universe?: number;
    monthCode?: string;
    expiryLabel?: string;
    label?: string;
    source?: string | null;
  };
  marketSync?: {
    ready?: boolean;
    syncBandPp?: number;
    insight?: string;
    howToRead?: string;
    cash?: {
      label?: string;
      basketMovePct?: number | null;
      niftyMovePct?: number | null;
      niftyVsBasketPp?: number | null;
      niftyVsBasketPts?: number | null;
      stance?: string;
      verdict?: string;
    };
    fo?: {
      label?: string;
      basketMovePct?: number | null;
      niftyMovePct?: number | null;
      niftyVsBasketPp?: number | null;
      niftyVsBasketPts?: number | null;
      stance?: string;
      verdict?: string;
      quoted?: number;
      universe?: number;
      monthCode?: string;
      ready?: boolean;
      note?: string;
    };
    cross?: {
      label?: string;
      diffPp?: number | null;
      stance?: string;
      verdict?: string;
    };
  };
  pcr: {
    ready: boolean;
    oiPcr?: number | null;
    volumePcr?: number | null;
    putOi?: number | null;
    callOi?: number | null;
    lean?: string | null;
    label?: string | null;
    expiry?: string | null;
    source?: string | null;
  };
  pcrHistory: NiftyPcrHistoryRow[];
  optionOi: {
    ready: boolean;
    source?: string | null;
    expiry?: string | null;
    spot?: number | null;
    atmStrike?: number | null;
    ceOiWing?: number | null;
    peOiWing?: number | null;
    ceOiChgWing?: number | null;
    peOiChgWing?: number | null;
    plot: {
      strike: number;
      ceOi: number;
      peOi: number;
      ceOiChg: number;
      peOiChg: number;
      ceUnwind?: number;
      peUnwind?: number;
      ceBuild?: number;
      peBuild?: number;
      moneyness?: string;
    }[];
    rows?: unknown[];
  };
  oiInsight?: {
    headline?: string;
    sentiment?: string;
    bullets?: string[];
    source?: string;
    metrics?: Record<string, unknown>;
  };
  insights: string[];
  paperTrades?: NiftyPaperTickPayload | null;
  building?: boolean;
  stale?: boolean;
  error?: string | null;
  cacheAgeS?: number;
}

export interface NiftyPaperTradeRow {
  id: number;
  strategyId?: string;
  status: string;
  side: string;
  symbol: string;
  strike?: number | null;
  expiry?: string | null;
  lot: number;
  entryTs: string;
  entryPx: number;
  entrySpot?: number | null;
  entryWeightUp?: number | null;
  entryReason?: string | null;
  exitTs?: string | null;
  exitPx?: number | null;
  exitSpot?: number | null;
  exitWeightUp?: number | null;
  exitReason?: string | null;
  peakPx?: number | null;
  pnlRs?: number | null;
  pnlPct?: number | null;
  marginRs?: number | null;
  markLtp?: number | null;
  markPnlRs?: number | null;
  markPnlPct?: number | null;
}

export interface NiftyPaperStrategyMeta {
  id: string;
  label: string;
  entry?: string;
  exit?: string;
  exitMode?: string;
  lot?: number;
  side?: string;
  tf?: string;
}

export interface NiftyPaperWallet {
  startingCapitalRs?: number;
  realizedPnlRs?: number;
  unrealizedPnlRs?: number;
  openMarginRs?: number | null;
  cashRs?: number;
  equityRs?: number;
  returnPct?: number;
  markSource?: string | null;
  books?: number;
  startingCapitalRsPerBook?: number;
  mongoReady?: boolean;
  storage?: string;
}

export interface NiftyPaperSummary {
  strategy?: NiftyPaperStrategyMeta & {
    tf?: string;
    entry?: string;
    exit?: string;
    lot?: number;
    side?: string;
  };
  open?: NiftyPaperTradeRow | null;
  closedCount?: number;
  wins?: number;
  losses?: number;
  netPnlRs?: number;
  avgMarginRs?: number | null;
  wallet?: NiftyPaperWallet;
  storage?: string;
  mongoReady?: boolean;
  markLtp?: number | null;
  markPnlRs?: number | null;
}

export interface NiftyPaperBucket {
  strategyId: string;
  summary: NiftyPaperSummary;
  trades: NiftyPaperTradeRow[];
}

export interface NiftyPaperBoardPayload {
  strategies: NiftyPaperStrategyMeta[];
  buckets: NiftyPaperBucket[];
  wallet?: NiftyPaperWallet;
  storage?: string;
  mongoReady?: boolean;
  signal?: {
    weightUpSeries?: number[];
    bucketLabels?: (string | null | undefined)[];
    rising3?: boolean;
    falling4?: boolean;
    entryHint?: string;
    barTf?: string;
  };
  liveLtp?: {
    asOf?: string;
    source?: string | null;
    atm?: {
      symbol?: string;
      strike?: number;
      ltp?: number;
      spot?: number | null;
      source?: string;
    } | null;
    positions?: Record<
      string,
      {
        symbol?: string;
        strike?: number | null;
        ltp?: number | null;
        entryPx?: number;
        pnlRs?: number | null;
        pnlPct?: number | null;
      }
    >;
  };
  /** Back-compat (first bucket) */
  summary?: NiftyPaperSummary;
  trades?: NiftyPaperTradeRow[];
}

export interface NiftyPaperTickPayload extends NiftyPaperBoardPayload {
  ok?: boolean;
  error?: string;
  skipped?: string;
  events?: string[];
  quote?: {
    symbol?: string;
    strike?: number;
    expiry?: string | null;
    ltp?: number;
    spot?: number | null;
    source?: string;
  };
  weightUpSeries?: number[];
  rising3?: boolean;
  falling4?: boolean;
  crossDiffPp?: number | null;
  liveDataWindow?: boolean;
}

export const NIFTY_PAPER_QUERY_KEY = ["nifty-paper-trades"] as const;

export async function fetchNiftyBoard(force = false): Promise<NiftyBoardPayload> {
  const q = force ? "?force=true" : "";
  try {
    await fetchHealth(force ? 90_000 : 45_000);
  } catch {
    /* continue */
  }
  return apiGet<NiftyBoardPayload>(`/api/nifty${q}`, undefined, force ? 180_000 : 90_000);
}

export async function fetchNiftyPaperTrades(evaluate = false): Promise<NiftyPaperBoardPayload> {
  const q = evaluate ? "?evaluate=true" : "";
  return apiGet(`/api/nifty/paper-trades${q}`, undefined, 45_000);
}

export async function tickNiftyPaperTrades(force = true): Promise<NiftyPaperTickPayload> {
  if (!API_BASE) throw new Error("VITE_API_BASE_URL is not set.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(
      `${API_BASE}/api/nifty/paper-trades/tick?force=${force ? "true" : "false"}`,
      { method: "POST", signal: ctrl.signal },
    );
    const body = (await res.json().catch(() => ({}))) as NiftyPaperTickPayload & { detail?: string };
    if (!res.ok) {
      throw new Error(typeof body.detail === "string" ? body.detail : `Paper tick failed: ${res.status}`);
    }
    if (body.ok === false) {
      throw new Error(body.error || "ATM CE quote unavailable (need Fyers)");
    }
    return body;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Paper tick timed out — Render may still be waking. Try again in a moment.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
