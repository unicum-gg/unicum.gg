"use client";

import Link from "next/link";
import { type ServerOnline, serverDisplayName } from "@unicum.gg/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { usePlayersOnline } from "@/hooks/use-players-online";
import { useRegion } from "@/hooks/use-region";

const fmt = new Intl.NumberFormat("en-US");

export function PlayersOnline() {
  const { region } = useRegion();
  const payload = usePlayersOnline(region);

  // The count is the shortest way into the servers page, which is this number
  // over time: the tooltip answers "who is where right now", the link answers
  // everything after that.
  const label = (
    <Link
      href={ROUTES.SERVERS(region)}
      className="shrink-0 font-medium tabular-nums text-fd-muted-foreground transition-colors hover:text-fd-foreground"
    >
      {payload ? fmt.format(payload.total) : "—"} players online
    </Link>
  );

  // Before the first payload lands there is no per-server breakdown to show,
  // so render the placeholder count on its own without a tooltip.
  if (!payload) return label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{label}</TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-1">
            {/* In identity order, like the servers page's own chips and table:
                Wargaming sorts its answer by population, and now that the label
                names a server rather than a rank, that order reads as EU1, EU3,
                EU5, EU2, EU4. */}
            {[...payload.servers]
              .sort((a, b) =>
                serverDisplayName(region, a.server).localeCompare(
                  serverDisplayName(region, b.server),
                  "en",
                  { numeric: true },
                ),
              )
              .map((s: ServerOnline) => (
                <div
                  key={s.server}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-background/70" title={s.server}>
                    {serverDisplayName(region, s.server)}
                  </span>
                  <span className="font-medium">
                    {fmt.format(s.players_online)}
                  </span>
                </div>
              ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
