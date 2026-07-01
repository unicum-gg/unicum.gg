"use client";

import type { ServerOnline } from "@/services/wargaming/wot/server/online";
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

  if (!payload) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 cursor-default font-medium tabular-nums text-[#f25322]">
            {fmt.format(payload.total)} players online
          </span>
        </TooltipTrigger>
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
