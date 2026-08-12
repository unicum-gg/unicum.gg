import type { TankVideoCardData } from "./card";

/** How many videos the Specifications preview shows. Shared, because the page
 * marks up exactly what it renders and the two must not drift apart. */
export const PREVIEW_VIDEO_COUNT = 2;

/** A video and every battle the community marked in it. */
export type TankVideoGroup = {
  videoId: string;
  title: string;
  channelName: string;
  gameVersion: string | null;
  /** When the recording went up on YouTube, carried on the video like the
   * version: every battle in it shares one. */
  publishedAt: Date | string | null;
  /** The tanks this video covers, in the order they appear. Empty on a tank's
   * own page, where every battle is that tank and saying so would be noise, and
   * on a video holding only tactics, which are about no vehicle. */
  tanks: { name: string; slug: string }[];
  /** The clans it credits, same rule. A tactic's card names the clan where a
   * random battle's names the vehicle: it is what the video is about. */
  clans: { tag: string; color: string | null; emblem: string | null }[];
  battles: TankVideoCardData[];
};

/**
 * One card per video, not per battle.
 *
 * A creator's episode holds a dozen battles, and each was suggested on its own
 * row, so the tab showed the same thumbnail and the same title a dozen times
 * over. Grouping is a rendering concern only: the row stays the unit everywhere
 * else, because a battle is what carries a map, a mode and an outcome.
 *
 * Videos keep the order the endpoint returned them in (most recently approved
 * first, by the first battle of each). Battles inside a video are ordered by
 * their timestamp, the order they happen in.
 */
export function groupBattlesByVideo(
  battles: TankVideoCardData[],
): TankVideoGroup[] {
  const groups = new Map<string, TankVideoGroup>();
  for (const battle of battles) {
    const group = groups.get(battle.videoId);
    if (group) {
      group.battles.push(battle);
      continue;
    }
    groups.set(battle.videoId, {
      videoId: battle.videoId,
      title: battle.title,
      channelName: battle.channelName,
      // Carried on the video rather than the row: it is when the recording was
      // published, so every battle in it shares one.
      gameVersion: battle.gameVersion,
      publishedAt: battle.publishedAt ?? null,
      tanks: [],
      clans: [],
      battles: [battle],
    });
  }
  for (const group of groups.values()) {
    group.battles.sort((a, b) => a.startSeconds - b.startSeconds);
    const seen = new Set<string>();
    for (const battle of group.battles) {
      if (!battle.tankSlug || !battle.tankName || seen.has(battle.tankSlug)) {
        continue;
      }
      seen.add(battle.tankSlug);
      group.tanks.push({ name: battle.tankName, slug: battle.tankSlug });
    }
    const seenClans = new Set<string>();
    for (const battle of group.battles) {
      if (!battle.clan || seenClans.has(battle.clan.tag)) continue;
      seenClans.add(battle.clan.tag);
      group.clans.push({
        tag: battle.clan.tag,
        color: battle.clan.color,
        emblem: battle.clan.emblem,
      });
    }
  }
  return [...groups.values()];
}

/**
 * The battle being watched: the last one whose timestamp the playhead passed.
 *
 * Derived rather than remembered, because the highlight used to be whichever
 * row was clicked last, so playing on into the next battle, or dragging the
 * player's own bar, left it pointing at the wrong one. The second of tolerance
 * covers a seek landing just short of its target.
 */
export function activeBattleAt(
  battles: TankVideoCardData[],
  seconds: number,
): number | null {
  let active: number | null = null;
  for (const battle of battles) {
    if (battle.startSeconds <= seconds + 1) active = battle.id;
  }
  return active;
}
