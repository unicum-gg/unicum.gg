import { createHash } from "node:crypto";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { readMotion, readReplay } from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { fetchReplay, replayBattle } from "@unicum.gg/core/battles/replays";
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

/**
 * The shape of this answer, bumped whenever a field is added or renamed.
 *
 * It rides in the ETag, which is what makes a format change reach people. The
 * first version of this route answered `immutable` and then changed shape
 * twice; every browser holding the old body kept drawing a stale map for as
 * long as the cache lasted, while the server had been right all along. With
 * the version in the validator, an old body simply fails to match and is
 * replaced on the next request.
 */
const FORMAT = 3;

/**
 * Always revalidate, and the ETag decides.
 *
 * Not a long `max-age`: a battle never changes but the SHAPE of this answer
 * does, and a body cached by time cannot be told it is out of date. The
 * round trip costs a 304 with no body and no decode, which is cheap enough to
 * pay every time for an answer that is never quietly wrong.
 */
const CACHE = { "cache-control": "public, max-age=0, must-revalidate" };

/** One vehicle's path, as `[clock ticks, x, z]`, and when it stopped living. */
type Track = {
  id: number;
  points: [number, number, number][];
  /**
   * The tick this vehicle was destroyed, or null if it survived.
   *
   * In the recording's clock, not the battle's: the two differ by the
   * countdown, about fifty seconds, so handing back the battle figure would
   * grey every wreck a minute early.
   */
  diedAt: number | null;
};

/**
 * How far the recording's clock runs ahead of the battle's, in seconds.
 *
 * A replay starts recording during the countdown, so its clock is not battle
 * time. The vehicles that survived are what pins the two together: they lived
 * exactly as long as the battle, so the gap between where their track ends and
 * their own `lifeTime` is the offset, and they all agree on it (measured on a
 * real battle: 52.6 s for every survivor, against 57 to 69 for the dead, whose
 * wrecks keep reporting for a while after they stop being alive).
 *
 * The median rather than any one of them, so a single odd track cannot move
 * it. Null when nobody survived, and the caller then greys nothing rather than
 * guessing.
 */
function clockOffset(
  tracks: { id: number; last: number }[],
  vehicles: { id: number; lifeTime: number; died: boolean }[],
): number | null {
  const gaps: number[] = [];
  for (const vehicle of vehicles) {
    if (vehicle.died || vehicle.lifeTime <= 0) continue;
    const track = tracks.find((t) => t.id === vehicle.id);
    if (track) gaps.push(track.last - vehicle.lifeTime);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

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

  const battle = await replayBattle(region as Region, normaliseBattleId(id));
  if (!battle) {
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  // Answered before anything is decoded. The validator is the object's key
  // and the format's version, neither of which needs the file opened: a
  // battle's replay never changes, so a match means the client's copy is
  // still exactly right and a megabyte of Blowfish can be skipped.
  const etag = `W/"${FORMAT}-${createHash("sha1").update(battle.key).digest("base64url")}"`;
  if (_req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, ...CACHE } });
  }

  const file = await fetchReplay(battle.key);
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

  const built: { id: number; points: [number, number, number][]; last: number }[] =
    [];
  for (const track of motion.tracks) {
    const points = thin(track.points);
    if (points.length === 0) continue;
    built.push({
      id: track.id,
      points,
      last: points[points.length - 1][0] / TICKS,
    });
  }

  const offset = clockOffset(built, battle.vehicles);
  const died = new Map(
    battle.vehicles
      .filter((v) => v.died && v.lifeTime > 0)
      .map((v) => [v.id, v.lifeTime]),
  );
  const tracks: Track[] = built.map((track) => {
    const life = died.get(track.id);
    return {
      id: track.id,
      points: track.points,
      diedAt:
        life !== undefined && offset !== null
          ? Math.round((life + offset) * TICKS)
          : null,
    };
  });
  if (tracks.length === 0) {
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  return jsonResponse(
    BattleReplayResponse,
    { duration: Math.round(motion.duration), ticksPerSecond: TICKS, tracks },
    {
      headers: { etag, ...CACHE },
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
