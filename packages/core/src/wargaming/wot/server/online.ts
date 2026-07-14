import { type Region, REGION_LABEL, WgnGame } from "@unicum.gg/wargaming";
import type { OnlinePayload } from "@unicum.gg/shared";
import { wg } from "../../client";

// Client-safe shapes live in `@unicum.gg/shared`; re-exported for back-compat.
export type { ServerOnline, OnlinePayload } from "@unicum.gg/shared";

export const fetchPlayersOnline = async (region: Region): Promise<OnlinePayload> => {
  try {
    const data = await wg.region(region).api.wgn.servers.info({ game: [WgnGame.WorldOfTanks] });
    const label = REGION_LABEL[region];
    const sorted = [...(data.wot ?? [])].sort((a, b) => b.players_online - a.players_online);
    const servers = sorted.map((s, i) => ({ ...s, server: `${label}${i + 1}` }));
    const total = servers.reduce((sum, s) => sum + s.players_online, 0);
    return { total, servers };
  } catch {
    return null;
  }
};
