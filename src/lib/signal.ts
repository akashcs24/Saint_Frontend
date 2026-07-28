import type { ActionHint, ConfidenceLabel, SignalTier, StockRow } from "@/lib/market-data";

export type { SignalTier };

/** Conviction visual tiers — green / gold / grey only (no red on signals). */
export function signalTier(conviction?: number | null, fallback?: string | null): SignalTier {
  if (fallback === "strong" || fallback === "medium" || fallback === "weak") return fallback;
  const c = conviction ?? 0;
  if (c >= 60) return "strong";
  if (c >= 40) return "medium";
  return "weak";
}

/** Surface classes for action / signal pills — never bear/red. */
export function signalSurface(tier: SignalTier, opts?: { ring?: boolean }) {
  const ring = opts?.ring !== false;
  if (tier === "strong") {
    return ring
      ? "bg-bull-soft text-bull ring-1 ring-bull/40"
      : "bg-bull-soft text-bull";
  }
  if (tier === "medium") {
    return ring
      ? "bg-gold-soft text-gold ring-1 ring-gold/35"
      : "bg-gold-soft text-gold";
  }
  return ring
    ? "bg-muted text-muted-foreground ring-1 ring-border"
    : "bg-muted text-muted-foreground";
}

export function signalBarClass(tier: SignalTier) {
  if (tier === "strong") return "bg-bull";
  if (tier === "medium") return "bg-gold";
  return "bg-muted-foreground/40";
}

export function signalTextClass(tier: SignalTier) {
  if (tier === "strong") return "text-bull";
  if (tier === "medium") return "text-gold";
  return "text-muted-foreground";
}

export function actionLabel(action?: ActionHint | string | null): string {
  if (!action) return "Watch";
  if (action === "buy long") return "Buy long";
  if (action === "buy short") return "Buy short";
  if (action === "already priced") return "Already priced";
  if (action === "already fallen") return "Already fallen";
  // Legacy fallbacks
  if (action === "buy") return "Buy long";
  if (action === "short" || action === "avoid") return "Buy short";
  return "Watch";
}

/** Primary board signal from action + direction lean. */
export function primarySignal(
  s: Pick<StockRow, "action" | "bias" | "direction" | "plainSentiment" | "expectedDirection">,
): string {
  const a = s.action;
  if (a === "buy long" || a === "buy" || a === "buy short" || a === "short" || a === "avoid") {
    return actionLabel(a);
  }
  if (a === "already priced" || a === "already fallen") return actionLabel(a);
  if (s.bias === "bullish" || s.direction === "up" || s.plainSentiment === "Positive") {
    return "Watch · long";
  }
  if (s.bias === "bearish" || s.direction === "down" || s.plainSentiment === "Negative") {
    return "Watch · short";
  }
  return "Watch";
}

export function tierFromConfidence(c?: ConfidenceLabel | null): SignalTier {
  if (c === "high") return "strong";
  if (c === "medium") return "medium";
  return "weak";
}
