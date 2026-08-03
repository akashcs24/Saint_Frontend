import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, Loader2, Unplug } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DASHBOARD_QUERY_KEY,
  exchangeFyersCode,
  fetchDashboard,
  fetchFyersAuthUrl,
  fetchFyersStatus,
  logoutFyers,
  NIFTY_QUERY_KEY,
} from "@/lib/api";
import { isLiveDataWindow, LIVE_DATA_LABEL } from "@/lib/market-hours";

export function FyersConnectButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ["fyers-status"],
    queryFn: fetchFyersStatus,
    staleTime: 20_000,
    // Stop probing Fyers overnight — only poll during live window.
    refetchInterval: () => (isLiveDataWindow() ? 45_000 : false),
    retry: 1,
  });

  // Token proven with Fyers (may still be after-hours with polling paused).
  const connected = Boolean(statusQ.data?.connected);
  const configured = statusQ.data?.configured !== false;
  const lastError = statusQ.data?.lastError || null;
  const hasToken = Boolean(statusQ.data?.hasToken);
  const marketHours = statusQ.data?.marketHours ?? isLiveDataWindow();
  const paused = Boolean(statusQ.data?.pausedOutsideHours) && connected;

  const title = connected
    ? paused
      ? `Fyers connected — quotes resume ${statusQ.data?.marketHoursLabel || LIVE_DATA_LABEL}`
      : "Fyers connected — realtime quotes OK"
    : lastError
      ? `Fyers offline — ${lastError}`
      : hasToken
        ? "Fyers token present but realtime failed — reconnect"
        : "Connect Fyers for realtime Nifty breadth";

  useEffect(() => {
    if (!open) return;
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchFyersAuthUrl();
        if (!cancelled) setAuthUrl(s.url);
      } catch (e) {
        if (!cancelled) {
          setAuthUrl(null);
          setError(e instanceof Error ? e.message : "Could not build Fyers login URL");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const openLoginTab = () => {
    if (!authUrl) return;
    window.open(authUrl, "_blank", "noopener,noreferrer");
  };

  const submitCode = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await exchangeFyersCode(code.trim());
      queryClient.setQueryData(["fyers-status"], status);
      setCode("");
      setOpen(false);
      setBusy(false);
      // Soft refresh in background — do not block modal close on dashboard build.
      void (async () => {
        try {
          const next = await fetchDashboard(false);
          queryClient.setQueryData(DASHBOARD_QUERY_KEY, next);
        } catch {
          await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        }
        await queryClient.invalidateQueries({ queryKey: NIFTY_QUERY_KEY });
      })();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Exchange failed");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const status = await logoutFyers();
      queryClient.setQueryData(["fyers-status"], status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logout failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Fyers realtime login"
          title={title}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors sm:px-3 ${
            connected
              ? "border-transparent bg-bull-soft text-bull hover:opacity-90"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {connected ? (paused ? "Fyers ok" : "Fyers live") : "Fyers"}
          </span>
          <span className="sm:hidden">{connected ? (paused ? "OK" : "Live") : "FY"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fyers realtime</DialogTitle>
          <DialogDescription>
            Connect once so Nifty breadth can use Fyers quotes instead of delayed Yahoo. Opens
            Fyers login in a new tab — copy the auth code (or full redirect URL) and paste it
            here. After hours the token stays valid; live quote polling resumes at the open.
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <p className="text-sm text-bear">
            API missing <code className="text-xs">FYERS_APP_ID</code> /{" "}
            <code className="text-xs">FYERS_SECRET_KEY</code>. Add them to the backend env
            (same app as your Fyers dashboard).
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Status:{" "}
              <span className={connected ? "font-medium text-bull" : "font-medium text-foreground"}>
                {connected
                  ? paused
                    ? "Connected · polling paused (after hours)"
                    : "Connected (live)"
                  : "Not connected"}
              </span>
              {statusQ.data?.breadthSourceHint ? (
                <span> · breadth prefers {statusQ.data.breadthSourceHint}</span>
              ) : null}
              {paused ? (
                <p className="mt-1.5 text-muted-foreground">
                  Token is valid. Live Fyers quote polling resumes{" "}
                  {statusQ.data?.marketHoursLabel || LIVE_DATA_LABEL}.
                </p>
              ) : null}
              {!connected && lastError ? (
                <p className="mt-1.5 text-bear">{lastError}</p>
              ) : null}
            </div>

            <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Click Open Fyers login (new tab).</li>
              <li>
                Sign in; on the redirect page copy the <strong>auth_code</strong> (or the whole URL).
              </li>
              <li>Paste below and click Connect.</li>
            </ol>

            <button
              type="button"
              onClick={openLoginTab}
              disabled={!authUrl || busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" />
              {authUrl ? "Open Fyers login" : "Preparing login URL…"}
            </button>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Auth code or redirect URL
              </span>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={3}
                placeholder="Paste auth_code=… or the full redirect URL"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              />
            </label>

            {error ? <p className="text-xs text-bear">{error}</p> : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {connected || hasToken ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : null}
          <button
            type="button"
            onClick={submitCode}
            disabled={busy || !code.trim() || !configured}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Connect
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
