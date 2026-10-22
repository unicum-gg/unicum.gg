"use client";

import { useFormat } from "@/hooks/use-format";
import Link from "@/components/link";
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
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";
import { Hint } from "@/components/hint";

const FMT_FORMAT = {} as const;

// The range the servers page renders, so the two read the same recorded figure.
// `current` and each cluster's own are the last recorded sample whatever the
// range, so the choice only decides which series comes along with them.
const FALLBACK_RANGE = ServerStatsRange.Day;

export function PlayersOnline() {
  const { num } = useFormat();
  const { region } = useRegion();
  const { t } = useTranslation("components/players-online");
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

  // Nothing to show is shown as nothing. This sits in the chrome of every page
  // on the site, so a placeholder reads as a broken number everywhere at once,
  // which is what a Wargaming outage turned it into: `wgn/servers/info` has
  // answered `504 SOURCE_NOT_AVAILABLE` for days at a time, and the recorded
  // fallback below only covers it until that too runs out. Saying "we do not
  // have it" by not claiming a count is the honest reading, and the quiet one.
  if (total == null) return null;

  const count = num(FMT_FORMAT).format(total);

  // The count is the shortest way into the servers page, which is this number
  // over time: the tooltip answers "who is where right now", the link answers
  // everything after that.
  //
  // Both wordings ship and CSS picks one, like the leaderboards' three metrics:
  // this is the chrome of every page, most of them prerendered, so the width
  // available is not something the server can read. The short one is what makes
  // the strip fit a phone once a signed-in reader's nickname and clan tag sit
  // at the other end of it.
  const label = (
    <Link
      href={ROUTES.SERVERS(region)}
      className="shrink-0 font-medium tabular-nums text-fd-muted-foreground transition-colors hover:text-fd-foreground"
    >
      <span className="hidden sm:inline">{t("count", { count })}</span>
      <span className="sm:hidden">{t("count-short", { count })}</span>
    </Link>
  );

  // A cluster we hold no figure for is left out rather than dashed, the same
  // rule one level down. With none of them measured there is no breakdown to
  // show, so the count stands on its own without a tooltip.
  const measured = servers.filter(
    (s): s is typeof s & { players: number } => s.players != null,
  );
  if (measured.length === 0) return label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{label}</TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-1">
            {measured.map((s) => (
              <div
                key={s.server}
                className="flex items-center justify-between gap-4"
              >
                <Hint content={s.server}>
                  <span className="text-background/70">
                    {serverDisplayName(region, s.server)}
                  </span>
                </Hint>
                <span className="font-medium">
                  {num(FMT_FORMAT).format(s.players)}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
