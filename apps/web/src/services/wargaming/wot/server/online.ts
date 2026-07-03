import { applicationIdFor, REGION_API_HOST } from "../fetch";
import { Region, REGION_LABEL } from "..";

export type ServerOnline = { server: string; players_online: number };
export type OnlinePayload = { total: number; servers: ServerOnline[] } | null;


export async function fetchPlayersOnline(region: Region): Promise<OnlinePayload> {
  try {
    const host = REGION_API_HOST[region];
    const res = await fetch(
      `https://${host}/wgn/servers/info/?application_id=${applicationIdFor(region)}&game=wot`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as
      | { status: "ok"; data: { wot: ServerOnline[] } }
      | { status: "error" };
    if (json.status !== "ok") return null;
    const label = REGION_LABEL[region];
    const sorted = [...json.data.wot].sort((a, b) => b.players_online - a.players_online);
    const servers = sorted.map((s, i) => ({ ...s, server: `${label}${i + 1}` }));
    const total = servers.reduce((sum, s) => sum + s.players_online, 0);
    return { total, servers };
  } catch {
    return null;
  }
}
