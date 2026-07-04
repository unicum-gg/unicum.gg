import type { Region } from "@unicum.gg/wargaming/region";
import { wg } from "../../client";

export type { ClanStrongholdData } from "@unicum.gg/wargaming/stronghold/wot";

export const fetchClanStronghold = (region: Region, clanId: number) =>
  wg.region(region).stronghold.clan({ clanId });
