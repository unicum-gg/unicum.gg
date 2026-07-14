import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type { ClanStrongholdData } from "@unicum.gg/wargaming";

export const fetchClanStronghold = (region: Region, clanId: number) =>
  wg.region(region).stronghold.clan({ clanId });
