import type { Region } from "@unicum.gg/wargaming/region";
import {
  AccountListSearchType,
  AccountInfoExtra,
} from "@unicum.gg/wargaming/api/wot/accounts";
import { wg } from "../client";

export type {
  PlayerInfo,
  PlayerStatistics,
  PlayerSearchResult,
} from "@unicum.gg/wargaming/api/wot/accounts";

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

export const getPlayersInfoBatch = (region: Region, accountIds: number[]) =>
  wg.region(region).api.wot.accounts.infoBatch({ accountIds, extra: EXTRA_STATS });

export const getAccountWTR = (region: Region, accountId: number) =>
  wg.region(region).api.wot.accounts.wtr({ accountId });

export const getAccountsWTRBatch = (region: Region, accountIds: number[]) =>
  wg.region(region).api.wot.accounts.wtrBatch({ accountIds });
