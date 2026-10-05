import { isRegion, type Region } from "@unicum.gg/wargaming";
import { readMotion, readReplay } from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { fetchReplay, storedReplayKey } from "@unicum.gg/core/battles/replays";
import { measured } from "@/services/perf";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleReplayResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * How often a position is kept, in samples per second.
 *
 * The file holds every change the client saw, which for a seven-minute battle
 * is a megabyte and a half of JSON once it reaches the browser. Two a second
 * is what a plan view of tanks that top out at 60 km/h can actually show: a
 * tank moves eight metres between samples, on a map drawn five hundred pixels
 * across for a kilometre, so four pixels.
 */
const HZ = 2;

/** One vehicle's path, as `[tenths of a second, x, z]`. */
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
    const points = decimate(track.points);
    if (points.length > 0) tracks.push({ id: track.id, points });
  }
  if (tracks.length === 0) {
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  return jsonResponse(
    BattleReplayResponse,
    { duration: Math.round(motion.duration), hz: HZ, tracks },
    {
      headers: {
        // A battle that has been played never changes, and neither does its
        // replay. Decoding one costs Blowfish over a couple of megabytes, so
        // this is worth not doing twice.
        "cache-control": "public, max-age=86400, immutable",
      },
    },
  );
}

/**
 * One track, thinned to `HZ` and rounded to whole metres.
 *
 * Rounded here rather than in the browser because it is most of the saving:
 * a coordinate written to six decimals costs eight characters where four do,
 * and a vehicle sitting still then writes the same three numbers, which
 * compresses to nothing.
 */
function decimate(
  points: [number, number, number, number][],
): [number, number, number][] {
  const out: [number, number, number][] = [];
  let next = -Infinity;
  for (const [at, x, , z] of points) {
    if (at < next) continue;
    next = at + 1 / HZ;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    // Tenths of a second: a battle runs under half an hour, so this stays a
    // small integer, and the viewer wants a number it can compare, not a float.
    out.push([Math.round(at * 10), Math.round(x), Math.round(z)]);
  }
  return out;
}
