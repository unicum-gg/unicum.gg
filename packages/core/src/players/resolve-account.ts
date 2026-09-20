import type { Region } from "@unicum.gg/wargaming";
import { discoverPlayersBackground } from "@unicum.gg/core/discovery/players";
import { findAccountIdByFormerNickname } from "@unicum.gg/core/players/name-history";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@unicum.gg/core/players/initial-data";
import { findAccountIdByRosterNickname } from "@unicum.gg/core/tournaments/roster-names";
import { findPlayerByNickname } from "@unicum.gg/core/wargaming/wot/accounts";

/**
 * Which account a nickname names, and everything we already hold about it.
 *
 * `nickname` is the name that account goes by as far as this resolution could
 * tell, which the caller compares with the one it was asked for to decide
 * whether to redirect. Null when only an id was recovered, so nothing may claim
 * the account answers to a name.
 */
export type ResolvedAccount = {
  accountId: number;
  initial: PlayerInitialData;
  nickname: string | null;
};

/**
 * Who a nickname belongs to, in four steps, ordered by authority.
 *
 * 1. Our own players table, which is the current holder as of our last refresh.
 * 2. Wargaming, which knows every current name and no past one.
 * 3. Our rename history, a rename we watched happen.
 * 4. The tournament rosters, the only archive we hold of a name dropped before
 *    we were watching: on EU, 462 history rows against 147,800 distinct roster
 *    nicknames nobody carries today.
 *
 * **Wargaming before either archive, or a reclaimed nickname sends its visitors
 * to the player who used to hold it.** Which is also why a FAILED Wargaming
 * lookup stops the resolution here rather than falling through: a blip is
 * indistinguishable from "nobody carries this name", and continuing would hand
 * a live player's URL to whichever account last entered a tournament under it.
 * Harmless while the history held 462 rows, a redirect onto a stranger's
 * profile against 147,800.
 */
export async function resolveAccountByNickname(
  region: Region,
  nickname: string,
): Promise<ResolvedAccount | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (initial.player)
    return {
      accountId: initial.player.accountId,
      initial,
      nickname: initial.player.nickname,
    };

  let wargamingAnswered = true;
  const found = await findPlayerByNickname(region, nickname).catch((err) => {
    wargamingAnswered = false;
    console.warn("[player detail] findPlayerByNickname failed:", err);
    return null;
  });
  if (found)
    return {
      accountId: found.account_id,
      initial: await loadPlayerInitialData(region, {
        accountId: found.account_id,
      }),
      nickname: found.nickname,
    };
  if (!wargamingAnswered) return null;

  const formerOwner = await formerAccountId(region, nickname);
  if (formerOwner === null) return null;
  const byAccount = await loadPlayerInitialData(region, {
    accountId: formerOwner,
  });

  // **A past name is served from what we hold, never fetched for.** The rosters
  // name 117,000 EU accounts we have never tracked, every one of them linked
  // from a team page, and a cold assembly spends two 1 RPS clan-portal calls
  // (the clan history, then the marks) on top of the account fetches. Letting a
  // page view start one per dead link hands a crawl of the tournament archive a
  // budget the clan backfill already owns, and the wait is what took the
  // cluster down on 2026-09-15. So an untracked account is handed to discovery,
  // which is a plain insert, and the snapshot pipeline fetches it on its own
  // schedule and in its own batches. The name resolves on a later visit, and
  // the team page stops linking a dead one at the same time.
  if (byAccount.player && byAccount.latestSnapshot)
    return {
      accountId: formerOwner,
      initial: byAccount,
      nickname: byAccount.player.nickname,
    };
  discoverPlayersBackground(region, [{ accountId: formerOwner }]);
  return null;
}

/** The account that last went by this name, ours first and the rosters after.
 * Both are single indexed reads and the miss is the common case here (a typo, a
 * bot, a scraper all reach this), so they run together rather than in turn. */
async function formerAccountId(
  region: Region,
  nickname: string,
): Promise<number | null> {
  const [renamed, entrant] = await Promise.all([
    findAccountIdByFormerNickname(region, nickname).catch(() => null),
    findAccountIdByRosterNickname(region, nickname).catch(() => null),
  ]);
  return renamed ?? entrant;
}
