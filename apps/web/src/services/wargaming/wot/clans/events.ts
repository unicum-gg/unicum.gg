import type { Region } from "@unicum.gg/wargaming/region";
import { wg } from "../../client";

export type { ClanRecentEvent } from "@unicum.gg/wargaming/portal/wot/clans";

export const getClanRecentEvents = (region: Region, clanId: number, maxItems = 30) =>
  wg.region(region).portal.clans.events({ clanId, maxItems });
