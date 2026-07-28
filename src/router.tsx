import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Keep dashboard/stock loaders fresh briefly so Back doesn't rebuild for ~45s. */
const STALE_MS = 45_000;

function PendingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Loading market…</p>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultStaleTime: STALE_MS,
    defaultPreloadStaleTime: STALE_MS,
    defaultPendingMs: 200,
    defaultPendingComponent: PendingScreen,
  });

  return router;
};
