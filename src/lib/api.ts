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

async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Start the backend and configure .env.local.");
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
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
  return apiGet<DashboardPayload>(`/api/dashboard${q}`);
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
