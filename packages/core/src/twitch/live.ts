import { db } from "@unicum.gg/core/db";
import { streamers, type LiveStreamer } from "@unicum.gg/shared";
import { getPlayersByAccounts } from "@unicum.gg/core/players";
import { getPlayerClansBatch } from "@unicum.gg/core/wargaming/wot/clans/listings";
import { isRegion, Region } from "@unicum.gg/wargaming";
import { getWotStreamsByLogin } from "./index";

/**
 * A tracked WoT player currently live on Twitch in the WoT category, joined to
 * their cached ratings and clan tag so the home rail / badges can rank and
 * colour them like the leaderboards. Both the lifetime and the 30-day WN7/WN8/
 * WNX ship so the rail's Overall / Past-30-days toggle (and the navbar metric
 * selector) can re-rank entirely client-side, with no refetch.
 */
export type { LiveStreamer } from "@unicum.gg/shared";

/**
 * Everyone in the `streamers` table who is live in the WoT category right now,
 * sorted by WNX (the UI re-sorts by the selected metric). Returns `[]` when the
 * Twitch feature is disabled or nobody is live, so callers can hide the section.
 */
export async function getLiveStreamers(): Promise<LiveStreamer[]> {
  const rows = await db.select().from(streamers);
  if (rows.length === 0) return [];

  const live = await getWotStreamsByLogin(rows.map((r) => r.twitchLogin));
  if (live.length === 0) return [];
  const byLogin = new Map(live.map((s) => [s.userLogin, s]));

  const liveRows = rows.filter(
    (r) => byLogin.has(r.twitchLogin) && isRegion(r.region),
  );
  if (liveRows.length === 0) return [];

  // Batch the player + clan lookups per region (both are keyed by region).
  const regions = [...new Set(liveRows.map((r) => r.region as Region))];
  const perRegion = new Map<
    Region,
    {
      players: Awaited<ReturnType<typeof getPlayersByAccounts>>;
      clans: Awaited<ReturnType<typeof getPlayerClansBatch>>;
    }
  >();
  await Promise.all(
    regions.map(async (region) => {
      const ids = liveRows
        .filter((r) => r.region === region)
        .map((r) => r.accountId);
      const [players, clans] = await Promise.all([
        getPlayersByAccounts(region, ids),
        getPlayerClansBatch(region, ids),
      ]);
      perRegion.set(region, { players, clans });
    }),
  );

  const out: LiveStreamer[] = [];
  for (const row of liveRows) {
    const region = row.region as Region;
    const bucket = perRegion.get(region);
    const player = bucket?.players.get(row.accountId);
    const stream = byLogin.get(row.twitchLogin);
    if (!player || !stream) continue;
    const clan = bucket?.clans.get(row.accountId);
    out.push({
      region,
      accountId: row.accountId,
      nickname: player.nickname,
      clanTag: clan?.tag ?? null,
      clanColor: clan?.color ?? null,
      wn7: player.wn7,
      wn8: player.wn8,
      wnx: player.wnx,
      wn730d: player.wn730d,
      wn830d: player.wn830d,
      wnx30d: player.wnx30d,
      twitchLogin: row.twitchLogin,
      twitchUserName: stream.userName,
      title: stream.title,
      viewerCount: stream.viewerCount,
      startedAt: stream.startedAt,
      thumbnailUrl: stream.thumbnailUrl,
    });
  }

  // Default order matches the default toggle state (Overall); the client
  // re-sorts by the selected period + metric on render.
  out.sort((a, b) => (b.wnx ?? 0) - (a.wnx ?? 0));
  return out;
}
