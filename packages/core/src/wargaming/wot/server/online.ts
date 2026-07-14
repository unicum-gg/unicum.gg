import { type Region, REGION_LABEL, WgnGame } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type ServerOnline = { server: string; players_online: number };
export type OnlinePayload = { total: number; servers: ServerOnline[] } | null;

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
