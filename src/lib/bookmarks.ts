import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "saint.bookmarks.v1";

type Listener = () => void;

let memory: string[] | null = null;
const listeners = new Set<Listener>();

function readRaw(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((s) => String(s).toUpperCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

function getSnapshot(): string[] {
  if (memory == null) memory = readRaw();
  return memory;
}

function getServerSnapshot(): string[] {
  return [];
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(next: string[]) {
  memory = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  emit();
}

/** Subscribe to bookmarked symbols (persisted in localStorage). */
export function useBookmarks() {
  const symbols = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isBookmarked = useCallback(
    (symbol: string) => symbols.includes(symbol.toUpperCase()),
    [symbols],
  );

  const toggle = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    const cur = getSnapshot();
    write(cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym]);
  }, []);

  const remove = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    write(getSnapshot().filter((s) => s !== sym));
  }, []);

  return { symbols, isBookmarked, toggle, remove };
}

/** Keep bookmarks in sync if another tab updates localStorage. */
export function useBookmarkStorageSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      memory = readRaw();
      emit();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function sortBookmarkedFirst<T extends { symbol: string }>(
  rows: T[],
  bookmarked: string[],
): T[] {
  if (!bookmarked.length) return rows;
  const rank = new Map(bookmarked.map((s, i) => [s, i]));
  return [...rows].sort((a, b) => {
    const ai = rank.has(a.symbol) ? rank.get(a.symbol)! : 9999;
    const bi = rank.has(b.symbol) ? rank.get(b.symbol)! : 9999;
    if (ai !== bi) return ai - bi;
    return 0;
  });
}
