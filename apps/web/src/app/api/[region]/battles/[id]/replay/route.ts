import { isRegion, type Region } from "@unicum.gg/wargaming";
import { readMotion, readReplay } from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { fetchReplay, storedReplayKey } from "@unicum.gg/core/battles/replays";
import { measured } from "@/services/perf";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleReplayResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Clock ticks a second in the timestamps below.
 *
 * Hundredths, not tenths. The recording is ten samples a second, so rounding
 * the clock to tenths would quantise the timing by the whole of the gap
 * between two points, and the stutter that removal of the thinning was meant
 * to cure would come straight back through the timestamps.
 */
const TICKS = 100;

/** One vehicle's path, as `[clock ticks, x, z]`. */
type Track = { id: number; points: [number, number, number][] };

/**
 * Where everybody was, for the 2D viewer, out of this battle's archived replay.
 *
 * **The decoded positions, never the file.** Two reasons, and the second is
 * the one that decides it: the positions are a few hundred kilobytes against
 * the file's 1.3 MB, and the file carries the whole packet stream the client
 * received, including the battle chat. Handing that out would publish what
 * thirty people typed, which nothing on this site asks for and nobody
 * consented to beyond the replay being kept.
 *
 * 404 when no replay was archived, which is the ordinary case: the player's
 * client only writes one when recording is on, one of the thirty needs to have
 * sent it, and the archive has a quota.
 */
/**
 * Battle replay
 * @description Where every vehicle was through a battle, for the 2D viewer, decoded from the replay file the players' own clients recorded. The decoded positions and nothing else: the file itself carries the whole packet stream the recording client received, the battle chat included, which is not published. 404 when no replay was kept for this battle, which is the ordinary case, since one exists only when a player who was there had recording on and shared it.
 * @pathParams battleParams
 * @response BattleReplayResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/battles/{id}/replay", () => GET__perf(...args));
}

async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
): Promise<Response> {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (!/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "invalid_battle" }, { status: 400 });
  }

  const key = await storedReplayKey(region as Region, normaliseBattleId(id));
  if (!key) {
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  const file = await fetchReplay(key);
  if (!file) {
    // The row points at an object the bucket no longer has: retention removed
    // it, or it was never written. Not a 500, because nothing is broken for
    // the reader; there is simply nothing to draw.
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  let motion;
  try {
    const { stream } = await readReplay(file);
    if (stream.length === 0) {
      return Response.json({ error: "no_replay" }, { status: 404 });
    }
    motion = readMotion(stream);
  } catch {
    return Response.json({ error: "unreadable_replay" }, { status: 422 });
  }

  const tracks: Track[] = [];
  for (const track of motion.tracks) {
    const points = thin(track.points);
    if (points.length > 0) tracks.push({ id: track.id, points });
  }
  if (tracks.length === 0) {
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  return jsonResponse(
    BattleReplayResponse,
    { duration: Math.round(motion.duration), ticksPerSecond: TICKS, tracks },
    {
      headers: {
        // Long, because a battle that has been played never changes and
        // decoding its replay costs Blowfish over a couple of megabytes.
        //
        // But NOT `immutable`, which is a promise about the bytes and not
        // about the battle: the shape of this answer did change once, and
        // every client that had cached it kept drawing nothing for a day
        // while the server was already right. `stale-while-revalidate` keeps
        // the speed and lets a changed shape reach people within the hour.
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}

/**
 * One track, rounded but not thinned.
 *
 * **Every point the replay holds.** An earlier version kept two a second, on
 * the grounds that a plan view of tanks topping out at 60 km/h cannot show
 * more. It can: the recording is ten a second (measured, median gap 0.1 s),
 * and at two the viewer draws a tank as a sequence of straight segments that
 * reads as a stutter however smoothly it interpolates between them. Keeping
 * everything costs 77 to 105 KB gzipped against 23 to 29, on a response
 * cached for a day, which is a trade worth making once.
 *
 * Hundredths of a second, not tenths, for the same reason: with points a
 * tenth apart, rounding the clock to tenths quantises the timing by the whole
 * of the gap, and the stutter comes back through the timestamps instead.
 *
 * Coordinates are rounded to whole metres, which is where the compression
 * comes from: half a metre is already under a pixel on a minimap, and a
 * vehicle sitting still then writes the same numbers, which deflate to
 * nothing.
 */
function thin(
  points: [number, number, number, number][],
): [number, number, number][] {
  const out: [number, number, number][] = [];
  let last = -1;
  for (const [at, x, , z] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const when = Math.round(at * 100);
    // Two samples landing on the same hundredth are the same instant as far
    // as anything drawn from this is concerned.
    if (when === last) continue;
    last = when;
    out.push([when, Math.round(x), Math.round(z)]);
  }
  return out;
}
