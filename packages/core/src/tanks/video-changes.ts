import romanNumerals from "roman-numerals";
import {
  BATTLE_FORMAT_LABEL,
  BattleFormat,
  BATTLE_RESULT_LABEL,
  BattleResult,
  formatTimestamp,
  MAP_GAME_MODE_LABEL,
  storedTeamSize,
  storedTier,
  tankVideos,
  type MapGameMode,
} from "@unicum.gg/shared";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { getClanTagById } from "@unicum.gg/core/clans/repository";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getTanksByIds } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import type { VideoEdit } from "@unicum.gg/core/tanks/video-edit";

const { toRoman } = romanNumerals as { toRoman: (n: number) => string };

/**
 * What a correction actually changed, in a moderator's words.
 *
 * The card can only ever show the battle as it stands now, which is the state
 * to judge but not the thing to notice: someone who read this card an hour ago
 * has no way to see that the tank under it moved. So the edit says it, field by
 * field, and says it in the names the form used rather than in the ids the row
 * stores.
 *
 * Both sides are resolved, not just the new one. A line reading "Tank: 22305 →
 * Pz.Kpfw. Neu" tells a moderator half of what they need, and the half it
 * withholds is the one they would have to look up.
 */

/** One field that moved, ready to print. */
export type VideoChange = { field: string; from: string; to: string };

const NOTHING = "—";

function labelOf<T extends string>(
  labels: Record<T, string>,
  value: string | null,
): string {
  if (!value) return NOTHING;
  return labels[value as T] ?? value;
}

/**
 * Compares the row as it was against the correction about to replace it.
 *
 * Answers an empty list when nothing moved, which happens for real: a form
 * opened, read and saved untouched is a correction that corrects nothing, and a
 * card should not claim otherwise.
 */
export async function describeVideoChanges(
  region: Region,
  before: typeof tankVideos.$inferSelect,
  after: VideoEdit,
  /** What the caller worked out on its way to storing it: the link parsed into
   * a video and a second, which the edit carries as a URL. */
  ref: { videoId: string; startSeconds: number },
): Promise<VideoChange[]> {
  const changes: VideoChange[] = [];
  const add = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from, to });
  };

  if (before.tankId !== after.tankId) {
    // The two ids this line is about, not the whole catalogue to find them in.
    const wanted = [before.tankId, after.tankId].filter(
      (id): id is number => id !== null,
    );
    const tanks = await getTanksByIds(region, wanted).catch(() => []);
    const name = (id: number | null) =>
      id === null
        ? NOTHING
        : (tanks.find((t) => t.tank_id === id)?.name ?? String(id));
    add("Tank", name(before.tankId), name(after.tankId));
  }

  if (before.arenaId !== after.arenaId) {
    const previous = before.arenaId
      ? await getMapDetailBySlug(region, before.arenaId).catch(() => null)
      : null;
    add("Map", previous?.name ?? before.arenaId ?? NOTHING, after.mapName);
  }

  add(
    "Mode",
    labelOf<MapGameMode>(MAP_GAME_MODE_LABEL, before.mode),
    labelOf<MapGameMode>(MAP_GAME_MODE_LABEL, after.mode),
  );
  add(
    "Spawn",
    before.spawnTeam ? `Team ${before.spawnTeam}` : NOTHING,
    `Team ${after.spawnTeam}`,
  );
  add(
    "Result",
    labelOf<BattleResult>(BATTLE_RESULT_LABEL, before.result),
    labelOf<BattleResult>(BATTLE_RESULT_LABEL, after.result),
  );
  add(
    "Format",
    labelOf<BattleFormat>(BATTLE_FORMAT_LABEL, before.format),
    labelOf<BattleFormat>(BATTLE_FORMAT_LABEL, after.format),
  );
  add(
    "Combined",
    before.combinedDamage?.toLocaleString("en-US") ?? NOTHING,
    after.combinedDamage?.toLocaleString("en-US") ?? NOTHING,
  );
  // Against what the row will hold, not against what the form sent: a format
  // that fixes these has them stored as null, so comparing the raw values
  // announces a change the database never made, on the same card whose own
  // Team size field reads the format's figure.
  const teamSize = storedTeamSize(after.format, after.teamSize);
  const tier = storedTier(after.format, after.tier);
  add(
    "Team size",
    before.teamSize ? `${before.teamSize}v${before.teamSize}` : NOTHING,
    teamSize ? `${teamSize}v${teamSize}` : NOTHING,
  );
  add("Tier", before.tier ? toRoman(before.tier) : NOTHING, tier ? toRoman(tier) : NOTHING);
  // The tag rather than the id, on both sides, which is what the credit reads
  // as everywhere it is shown. The old one is resolved from what was stored, so
  // a clan that has since been renamed still reads as the credit it was.
  const beforeTag =
    before.clanRegion && isRegion(before.clanRegion) && before.clanId !== null
      ? await getClanTagById(before.clanRegion, before.clanId).catch(() => null)
      : null;
  add(
    "Clan",
    beforeTag ? `[${beforeTag}]` : NOTHING,
    after.clanTag ? `[${after.clanTag}]` : NOTHING,
  );
  add("Video", before.videoId, ref.videoId);
  add(
    "Starts at",
    formatTimestamp(before.startSeconds),
    formatTimestamp(ref.startSeconds),
  );

  return changes;
}
