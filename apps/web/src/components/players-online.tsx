"use client";

import type { ServerOnline } from "@unicum.gg/core/wargaming/wot/server/online";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePlayersOnline } from "@/hooks/use-players-online";
import { useRegion } from "@/hooks/use-region";

const fmt = new Intl.NumberFormat("en-US");

export function PlayersOnline() {
  const { region } = useRegion();
  const payload = usePlayersOnline(region);

  const label = (
    <span className="shrink-0 cursor-default font-medium tabular-nums text-[#f25322]">
      {payload ? fmt.format(payload.total) : "—"} players online
    </span>
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
            {payload.servers.map((s: ServerOnline) => (
              <div key={s.server} className="flex items-center justify-between gap-4">
                <span className="text-background/70">{s.server}</span>
                <span className="font-medium">{fmt.format(s.players_online)}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
