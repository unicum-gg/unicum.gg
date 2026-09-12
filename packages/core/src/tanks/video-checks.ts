import { env } from "@unicum.gg/shared";
import type { MapGameMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { discordBotEnabled } from "@unicum.gg/core/discord";
import { resolveBattleMap } from "@unicum.gg/core/wargaming/wot/maps";
import { wg } from "@unicum.gg/core/wargaming/client";

/**
 * What a suggested video is checked against, whether it is being sent for the
 * first time or corrected afterwards.
 *
 * Shared rather than duplicated because the two paths have to agree: an edit
 * that validated less than a submission would be a way around the rules by
 * sending a battle and then fixing it into something the form would have
 * refused.
 */

/** What YouTube says a video is. */
export type Oembed = { title: string; author_name: string };

/**
 * oEmbed needs no API key and no quota, and it fails exactly where we want to
 * refuse anyway: a deleted, private or embedding-disabled video answers 401/404,
 * so a link nobody could watch never reaches the queue.
 */
export async function fetchOembed(videoId: string): Promise<Oembed | null> {
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`,
    { signal: AbortSignal.timeout(8000) },
  ).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as Oembed | null;
  return data?.title ? data : null;
}

/**
 * The client version in play, stamped rather than asked for.
 *
 * Balance moves between patches, so a reader wants to know a video is two
 * patches old, but a submitter would be guessing. Null when WG does not answer:
 * an unknown version is better than a wrong one.
 */
export async function currentGameVersion(
  region: Region,
): Promise<string | null> {
  return wg
    .region(region)
    .api.wot.encyclopedia.info({ fields: ["game_version"] })
    .then((info) => info.game_version ?? null)
    .catch(() => null);
}

/** Whether the declared map and mode exist and go together. A map that does not
 * run Assault must not carry an Assault video: the filter it feeds would then
 * lie about which battles happened where. */
export async function mapIsConsistent(
  region: Region,
  arenaId: string,
  mode: MapGameMode,
): Promise<boolean> {
  const map = await resolveBattleMap(region, arenaId).catch(() => null);
  if (!map) return false;
  return map.modes.includes(mode);
}

/** Submissions are only open when a moderator could actually see them, and the
 * same holds for corrections: an edit re-posts or rewrites the card it is
 * judged on. */
export function videoSubmissionsEnabled(): boolean {
  return discordBotEnabled() && Boolean(env.DISCORD_VIDEO_CHANNEL_ID);
}
