import type { MapMarker, MapModeGeometry } from "../maps";

/**
 * Community-suggested gameplay videos: the pure half, shared by the submission
 * form (which validates before sending), the endpoint (which validates again,
 * because a client is not a gate) and the tab that renders them.
 *
 * Nothing here touches the network or the database.
 */

/** YouTube ids are exactly 11 characters of the URL-safe alphabet. */
const VIDEO_ID = /^[\w-]{11}$/;

/** What a submitted link resolves to. */
export type YoutubeRef = {
  videoId: string;
  /** Where the battle starts. 0 when the link carried no timestamp. */
  startSeconds: number;
};

/**
 * `?t=` accepts several shapes depending on where the link was copied from:
 * a bare count of seconds (`t=1530`), the same with a trailing unit
 * (`t=1530s`), or a composed duration (`t=1h5m30s`), which is what YouTube's
 * own "copy at current time" produces on long VODs.
 */
function parseTimestamp(raw: string | null): number {
  if (!raw) return 0;
  const plain = /^(\d+)s?$/.exec(raw.trim());
  if (plain) return Number(plain[1]);
  const composed = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw.trim());
  if (!composed || raw.trim() === "") return 0;
  const [, h, m, s] = composed;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/**
 * The video and start time a YouTube link points at, or null when it is not one.
 *
 * Deliberately strict: what comes back is embedded in an iframe on a page we
 * serve, so anything that is not recognisably a YouTube video id is refused
 * rather than passed through. The four accepted shapes are the ones a person
 * actually copies: the watch URL, the `youtu.be` short link, `/embed/`, and
 * `/live/` for a stream replay.
 */
export function parseYoutubeUrl(input: string): YoutubeRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^(www|m)\./, "");
  const startSeconds = parseTimestamp(url.searchParams.get("t"));

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return VIDEO_ID.test(id) ? { videoId: id, startSeconds } : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return VIDEO_ID.test(id) ? { videoId: id, startSeconds } : null;
  }
  const path = /^\/(embed|live|shorts)\/([^/?#]+)/.exec(url.pathname);
  if (path && VIDEO_ID.test(path[2])) {
    return { videoId: path[2], startSeconds };
  }
  return null;
}

/** Thumbnail for a video. `hqdefault` exists for every video, unlike
 * `maxresdefault`, which 404s on anything not uploaded in HD. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Embed URL that opens on the battle rather than on the start of a three-hour
 * VOD. `youtube-nocookie.com` is the privacy-preserving host, which matters
 * because the player only mounts after a click on our own thumbnail. */
export function youtubeEmbedUrl(videoId: string, startSeconds: number): string {
  const start = startSeconds > 0 ? `?start=${startSeconds}&autoplay=1` : "?autoplay=1";
  return `https://www.youtube-nocookie.com/embed/${videoId}${start}`;
}

/** The canonical link out, for the "watch on YouTube" affordance. */
export function youtubeWatchUrl(videoId: string, startSeconds: number): string {
  const t = startSeconds > 0 ? `&t=${startSeconds}` : "";
  return `https://www.youtube.com/watch?v=${videoId}${t}`;
}

/**
 * The inverse of `formatTimestamp`, for the form's own start-time field.
 *
 * Accepts what someone would actually type after reading a YouTube player:
 * `1:05:30`, `1h05:30`, `65:30`, `5:30` or a bare count of seconds. Null when
 * it is not a time at all, so the field can say so rather than silently
 * submitting zero, which is the failure this field exists to prevent.
 */
export function parseTimestampInput(text: string): number | null {
  const raw = text.trim().toLowerCase();
  if (raw === "") return null;
  if (/^\d+$/.test(raw)) return Number(raw);

  const parts = raw.replace(/h/g, ":").split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

/** `1h05:30` / `12:04`, for labelling where in the video a battle starts. */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}h` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Which way a team starts from, in the reader's terms. */
export enum SpawnDirection {
  North = "north",
  South = "south",
  East = "east",
  West = "west",
}

export const SPAWN_DIRECTION_LABEL: Record<SpawnDirection, string> = {
  [SpawnDirection.North]: "North",
  [SpawnDirection.South]: "South",
  [SpawnDirection.East]: "East",
  [SpawnDirection.West]: "West",
};

function centre(markers: MapMarker[]): MapMarker | null {
  if (markers.length === 0) return null;
  const left = markers.reduce((sum, m) => sum + m.left, 0) / markers.length;
  const top = markers.reduce((sum, m) => sum + m.top, 0) / markers.length;
  return { left, top };
}

/**
 * The direction a team starts from, derived from the map's own geometry rather
 * than declared by the submitter.
 *
 * Asking for it would let it contradict the map ("Himmelsdorf, East" when that
 * map has no east side in play), and it is not something a player thinks in:
 * they know which side of the minimap they started on. So the form asks for the
 * team, and this reads the answer off the markers we already project for the map
 * pages.
 *
 * **Spawns first, then bases, and only when both teams have one.** Spawn points
 * would be the obvious source and are almost never there: of 40 maps sampled
 * that run Standard, exactly one declares `teamSpawnPoints` for it, because the
 * game only writes them into the gameplay types that need to override a
 * default. Bases answer the same question, since a team's base sits on its own
 * side, but only in a two-base mode. Assault has a single base, the defender's,
 * so the attacker would be placed against the map centre and come out with an
 * arbitrary heading: measured on the 19 cases where both sources exist, the two
 * agree 16 times and the 3 disagreements are all Assault. Requiring a base on
 * each side excludes those without naming a mode, and the modes it excludes are
 * exactly the ones that do declare spawns.
 *
 * Null when neither source qualifies, where the caller shows no direction rather
 * than a guess.
 *
 * The axis is whichever of the two separates the sides most: a map whose teams
 * sit north/south is usually also slightly apart horizontally, and the larger
 * gap is the meaningful one.
 */
export function spawnDirection(
  geometry: Pick<MapModeGeometry, "spawns" | "bases">,
  team: 1 | 2,
): SpawnDirection | null {
  const side = (markers: { team1: MapMarker[]; team2: MapMarker[] }) => ({
    ours: centre(team === 1 ? markers.team1 : markers.team2),
    theirs: centre(team === 1 ? markers.team2 : markers.team1),
  });

  const fromSpawns = side(geometry.spawns);
  const fromBases = side(geometry.bases);
  // Both sides required on the base fallback: one base means an asymmetric mode
  // where the other team's position simply is not encoded.
  const source = fromSpawns.ours
    ? fromSpawns
    : fromBases.ours && fromBases.theirs
      ? fromBases
      : null;
  if (!source?.ours) return null;
  const { ours, theirs } = source;
  // A spawn-derived side with no opposite (a single-spawn mode) still has a
  // heading: compare it to the middle of the map.
  const other = theirs ?? { left: 50, top: 50 };

  const dx = ours.left - other.left;
  const dy = ours.top - other.top;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? SpawnDirection.West : SpawnDirection.East;
  }
  // `top` grows downward on the image, so a smaller value is further north.
  return dy < 0 ? SpawnDirection.North : SpawnDirection.South;
}
