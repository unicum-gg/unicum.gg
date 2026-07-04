import type { Region } from "@unicum.gg/wargaming/region";
import { wg } from "../../client";

export { ClanRole } from "@unicum.gg/wargaming/portal/wot/clan-enums";
export type {
  ClanMemberPeriodStats,
  PortalClanMember,
} from "@unicum.gg/wargaming/portal/wot/clans";

export const getClanMembersStats = (region: Region, clanId: number) =>
  wg.region(region).portal.clans.members({ clanId });
