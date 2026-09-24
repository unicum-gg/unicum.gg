import { type Region, AccountListSearchType, AccountInfoExtra } from "@unicum.gg/wargaming";
import { wg } from "../client";

export type {
  PlayerInfo,
  PlayerStatistics,
  PlayerSearchResult,
} from "@unicum.gg/wargaming";

// The per-mode stat blocks this app surfaces on player pages. The SDK is
// field-neutral; we tell it which extra blocks we want.
const EXTRA_STATS = [
  AccountInfoExtra.Epic,
  AccountInfoExtra.Fallout,
  AccountInfoExtra.GlobalMapAbsolute,
  AccountInfoExtra.GlobalMapChampion,
  AccountInfoExtra.GlobalMapMiddle,
  AccountInfoExtra.RankedBattles,
];

export const findPlayerByNickname = (region: Region, nickname: string) =>
  wg
    .region(region)
    .api.wot.accounts.list({ search: nickname, type: AccountListSearchType.Exact, limit: 1 })
    .then((r) => r[0] ?? null);

export const findPlayersByPrefix = (region: Region, prefix: string, limit = 10) =>
  wg
    .region(region)
    .api.wot.accounts.list({ search: prefix, type: AccountListSearchType.StartsWith, limit });

export const getPlayerInfo = (region: Region, accountId: number) =>
  wg.region(region).api.wot.accounts.info({ accountId, extra: EXTRA_STATS });

/**
 * The name an account currently answers to, and nothing else.
 *
 * `getPlayerInfo` above asks for the six extra stat blocks a player page reads,
 * which is the wrong trade on the login path: the only field wanted there is
 * the nickname, and the player is held on the callback while it arrives. Hence
 * the narrowed `fields` and the exemption from the shared limiter, so the wait
 * is a WG round-trip rather than a place in the background queue.
 */
export const getAccountNickname = (region: Region, accountId: number) =>
  wg
    .region(region)
    .api.wot.accounts.info({ accountId, fields: ["nickname"] }, { skipRateLimit: true })
    .then((info) => info?.nickname?.trim() || null);

export const getPlayersInfoBatch = (region: Region, accountIds: number[]) =>
  wg.region(region).api.wot.accounts.infoBatch({ accountIds, extra: EXTRA_STATS });

export const getAccountWTR = (region: Region, accountId: number) =>
  wg.region(region).api.wot.accounts.wtr({ accountId });

export const getAccountsWTRBatch = (region: Region, accountIds: number[]) =>
  wg.region(region).api.wot.accounts.wtrBatch({ accountIds });

/**
 * Medal counts for a set of accounts, keyed by achievement id.
 *
 * Batched 100 per request, the same granularity as `account/info`, which is
 * what makes storing achievements affordable at all: one request per hundred
 * players rather than one per player. `fields` is narrowed to `achievements`
 * because the endpoint also returns `frags` and `max_series`, neither of which
 * we keep, and they are the bulk of the payload.
 */
export const getAccountsAchievementsBatch = (
  region: Region,
  accountIds: number[],
) =>
  wg
    .region(region)
    .api.wot.accounts.achievementsBatch({
      accountIds,
      fields: ["achievements"] as const,
    })
    .then((m) => {
      const out = new Map<number, Record<string, number>>();
      for (const [id, entry] of m) out.set(id, entry.achievements ?? {});
      return out;
    });
