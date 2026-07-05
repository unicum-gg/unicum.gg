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

/** A member as returned by the WG API `clans/info` `members` field. */
type ApiClanMember = {
  account_id: number;
  account_name: string;
  joined_at: number;
  role: string;
  role_i18n: string;
};

/** Map an API roster member to our `PortalClanMember` shape. Per-member figures
 * the API does not carry (`overall`, `personalRating`, `lastBattleTime`) are
 * left null and backfilled from our own player snapshots in `refreshClanMembers`. */
const mapMember = (m: ApiClanMember, now: number): PortalClanMember => ({
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
});

/**
 * Clan roster from the batchable WG API (`clans/info` members field) rather
 * than the per-clan clan portal, so refreshing a clan no longer spends the
 * scarce 1 RPS portal budget on the roster. Single-clan variant, used for the
 * on-demand refresh path; the cron uses {@link getClanMembersBatch}.
 */
export const getClanMembersStats = async (
  region: Region,
  clanId: number,
): Promise<PortalClanMember[]> => {
  const info = await wg
    .region(region)
    .api.wot.clans.info({ clanId, fields: ["members"] });
  const now = Date.now();
  return (info?.members ?? []).map((m) => mapMember(m, now));
};

/**
 * Rosters for many clans in a SINGLE `clans/info` call (up to 100 clan ids).
 * The cron uses this so a drain no longer fires one `clans/info` per clan on
 * top of the batched clan-info fetch — that per-clan fan-out is what pushed the
 * EU API bucket into overload.
 */
export const getClanMembersBatch = async (
  region: Region,
  clanIds: number[],
): Promise<Map<number, PortalClanMember[]>> => {
  const out = new Map<number, PortalClanMember[]>();
  const unique = Array.from(new Set(clanIds));
  if (unique.length === 0) return out;
  const byClan = await wg
    .region(region)
    .api.wot.clans.infoBatch({ clanIds: unique, fields: ["members"] });
  const now = Date.now();
  for (const [id, info] of byClan) {
    out.set(id, (info?.members ?? []).map((m) => mapMember(m, now)));
  }
  return out;
};
