"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  mergeServerOnline,
  type ServerStats,
  ServerStatsRange,
  serverDisplayName,
} from "@unicum.gg/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { usePlayersOnline } from "@/hooks/use-players-online";
import { useRegion } from "@/hooks/use-region";
import { unicum } from "@/services/sdk";

const fmt = new Intl.NumberFormat("en-US");

// The range the servers page renders, so the two read the same recorded figure.
// `current` and each cluster's own are the last recorded sample whatever the
// range, so the choice only decides which series comes along with them.
const FALLBACK_RANGE = ServerStatsRange.Day;

export function PlayersOnline() {
  const { region } = useRegion();
  const live = usePlayersOnline(region);

  // The same fallback the servers page is handed by the server: the last
  // recorded sample, so the count stands through a Wargaming outage instead of
  // blanking out. It is read here rather than passed down because the top bar
  // is the chrome of every page, most of them prerendered, and the region is
  // only known once we are in the browser (see `useRegion`), which is the same
  // reason `useMoney` fetches its rates client-side.
  //
  // One request per hard load, not per page: SWR keeps it under its key for the
  // session, and a soft nav reuses it.
  const { data: recorded } = useSWR(
    ["server-stats", region, FALLBACK_RANGE] as const,
    ([, r, range]) =>
      unicum.region(r).server.stats(range) as Promise<ServerStats>,
    {
      revalidateOnFocus: false,
      // The sampler's own cadence: revalidating faster cannot surface anything
      // newer, and the live figure comes over SSE anyway.
      dedupingInterval: 300_000,
    },
  );

  const { total, servers } = mergeServerOnline(
    region,
    live,
    recorded?.current ?? null,
    recorded?.clusters ?? [],
  );

  // The count is the shortest way into the servers page, which is this number
  // over time: the tooltip answers "who is where right now", the link answers
  // everything after that.
  const label = (
    <Link
      href={ROUTES.SERVERS(region)}
      className="shrink-0 font-medium tabular-nums text-fd-muted-foreground transition-colors hover:text-fd-foreground"
    >
      {total == null ? "—" : fmt.format(total)} players online
    </Link>
  );

  // Before either source lands there is no per-server breakdown to show, so
  // render the placeholder count on its own without a tooltip.
  if (servers.length === 0) return label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{label}</TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-1">
            {servers.map((s) => (
              <div
                key={s.server}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-background/70" title={s.server}>
                  {serverDisplayName(region, s.server)}
                </span>
                <span className="font-medium">
                  {s.players == null ? "—" : fmt.format(s.players)}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
