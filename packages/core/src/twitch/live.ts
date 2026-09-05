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

  // Degrades to "nobody is live" rather than propagating. Twitch is a third
  // party on the request path of a decorative rail, so a failure there must cost
  // the section and nothing else: the reader still gets the page, and the SSE
  // channel (fed by the worker, which polls Twitch on its own) fills the rail in
  // as soon as it publishes. Logged loudly because a silent empty rail reads
  // exactly like "no streamer is live right now".
  let live;
  try {
    live = await getWotStreamsByLogin(rows.map((r) => r.twitchLogin));
  } catch (err) {
    console.error("[live-streamers] Twitch lookup failed, serving none:", err);
    return [];
  }
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

  // Resolve each live row to its card inputs, dropping accounts we have no
  // cached player/stream for.
  type PlayersMap = Awaited<ReturnType<typeof getPlayersByAccounts>>;
  type ClansMap = Awaited<ReturnType<typeof getPlayerClansBatch>>;
  type Resolved = {
    row: (typeof liveRows)[number];
    region: Region;
    player: NonNullable<ReturnType<PlayersMap["get"]>>;
    stream: NonNullable<ReturnType<typeof byLogin.get>>;
    clan: ReturnType<ClansMap["get"]>;
  };
  const resolved: Resolved[] = [];
  for (const row of liveRows) {
    const region = row.region as Region;
    const bucket = perRegion.get(region);
    const player = bucket?.players.get(row.accountId);
    const stream = byLogin.get(row.twitchLogin);
    if (!player || !stream) continue;
    resolved.push({
      row,
      region,
      player,
      stream,
      clan: bucket?.clans.get(row.accountId),
    });
  }

  // One card per live channel: a streamer can link several WoT accounts to the
  // same Twitch channel, so collapse them to the most active account (most
  // 30-day battles, WNX as tiebreak) rather than duplicating the same stream.
  const bestByLogin = new Map<string, Resolved>();
  const activityOf = (r: Resolved): [number, number] => [
    r.player.battles30d ?? -1,
    r.player.wnx ?? 0,
  ];
  for (const r of resolved) {
    const cur = bestByLogin.get(r.row.twitchLogin);
    if (!cur) {
      bestByLogin.set(r.row.twitchLogin, r);
      continue;
    }
    const [rb, rw] = activityOf(r);
    const [cb, cw] = activityOf(cur);
    if (rb > cb || (rb === cb && rw > cw)) {
      bestByLogin.set(r.row.twitchLogin, r);
    }
  }

  const out: LiveStreamer[] = [];
  for (const { row, region, player, stream, clan } of bestByLogin.values()) {
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
      language: stream.language,
      thumbnailUrl: stream.thumbnailUrl,
    });
  }

  // Default order matches the default toggle state (Overall); the client
  // re-sorts by the selected period + metric on render.
  out.sort((a, b) => (b.wnx ?? 0) - (a.wnx ?? 0));
  return out;
}
