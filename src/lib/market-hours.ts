/** NSE live-data window for Fyers / Nifty refresh (matches backend). */

const IST = "Asia/Kolkata";

export const LIVE_DATA_LABEL = "09:14–15:30 IST · trading days";

function partsInIST(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

/** Mon–Fri 09:14–15:30 IST (weekends only; holidays still “open” on client). */
export function isLiveDataWindow(date = new Date()): boolean {
  const p = partsInIST(date);
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return minutes >= 9 * 60 + 14 && minutes <= 15 * 60 + 30;
}
