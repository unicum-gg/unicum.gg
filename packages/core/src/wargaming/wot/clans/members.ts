import {
  type Region,
  ClanRole,
  type PortalClanMember,
  clanRoleOrder,
  isClanRole,
} from "@unicum.gg/wargaming";
import { wg } from "../../client";

export { ClanRole } from "@unicum.gg/wargaming";
export type {
  ClanMemberPeriodStats,
  PortalClanMember,
} from "@unicum.gg/wargaming";

// A role WG sends that `ClanRole` does not know sorts below every real one, so
// it would quietly land at the bottom of every roster rather than surface as a
// failure. That is exactly how `recruitment_officer` sat under the reservists
// for as long as the enum was missing it, so say it once per unknown role.
const warnedRoles = new Set<string>();
const warnUnknownRole = (role: string) => {
  if (warnedRoles.has(role)) return;
  warnedRoles.add(role);
  console.warn(
    `[clans] unknown clan role "${role}", add it to ClanRole in its hierarchy position. Members holding it sort last until then`,
  );
};

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
const mapMember = (m: ApiClanMember, now: number): PortalClanMember => {
  if (!isClanRole(m.role)) warnUnknownRole(m.role);
  return {
    accountId: m.account_id,
    name: m.account_name,
    role: m.role as ClanRole,
    roleLocalized: m.role_i18n,
    roleRank: clanRoleOrder(m.role),
    daysInClan: Math.max(0, Math.floor((now - m.joined_at * 1000) / DAY_MS)),
    lastBattleTime: null,
    personalRating: null,
    overall: null,
    d28: null,
  };
};

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
