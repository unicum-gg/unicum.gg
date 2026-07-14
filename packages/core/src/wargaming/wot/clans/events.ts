import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type { ClanRecentEvent } from "@unicum.gg/wargaming";

export const getClanRecentEvents = (region: Region, clanId: number, maxItems = 30) =>
  wg.region(region).portal.clans.events({ clanId, maxItems });
