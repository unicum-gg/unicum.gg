import type { Region } from "@unicum.gg/wargaming/region";
import { ClanRole } from "@unicum.gg/wargaming/portal/wot/clan-enums";
import type { PortalClanMember } from "@unicum.gg/wargaming/portal/wot/clans";
import { wg } from "../../client";

export { ClanRole } from "@unicum.gg/wargaming/portal/wot/clan-enums";
export type {
  ClanMemberPeriodStats,
  PortalClanMember,
} from "@unicum.gg/wargaming/portal/wot/clans";

// Role hierarchy → numeric rank (0 = commander, highest). The batchable API
// gives the role string + localized label but not the `role.rank` the portal
// carried, so derive it from the canonical enum order to keep member sorting
// stable.
const ROLE_RANK: Record<string, number> = Object.fromEntries(
  Object.values(ClanRole).map((role, i) => [role, i]),
);
const UNKNOWN_ROLE_RANK = Object.keys(ROLE_RANK).length;

const DAY_MS = 86_400_000;

/**
 * Clan roster from the batchable WG API (`clans/info` members field) rather
 * than the per-clan clan portal, so refreshing a clan no longer spends the
 * scarce 1 RPS portal budget on the roster. Per-member figures the API does
 * not carry (`overall`, `personalRating`, `lastBattleTime`) are left null and
 * backfilled from our own player snapshots in `refreshClanMembers`; the newsfeed
 * (`portal.clans.events`) remains the one genuinely per-clan portal call.
 */
export const getClanMembersStats = async (
  region: Region,
  clanId: number,
): Promise<PortalClanMember[]> => {
  const info = await wg
    .region(region)
    .api.wot.clans.info({ clanId, fields: ["members"] });
  const members = info?.members ?? [];
  const now = Date.now();
  return members.map((m) => ({
    accountId: m.account_id,
    name: m.account_name,
    role: m.role as ClanRole,
    roleLocalized: m.role_i18n,
    roleRank: ROLE_RANK[m.role] ?? UNKNOWN_ROLE_RANK,
    daysInClan: Math.max(0, Math.floor((now - m.joined_at * 1000) / DAY_MS)),
    lastBattleTime: null,
    personalRating: null,
    overall: null,
    d28: null,
  }));
};
