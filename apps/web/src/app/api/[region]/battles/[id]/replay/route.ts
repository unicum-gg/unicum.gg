import { createHash } from "node:crypto";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import {
  activeLayout,
  minimapIndex,
  readLoadouts,
  readMotion,
  readReplay,
  replayClockOffset,
  type ChatLine,
  type ReplayLoadout,
  unseenShotEnd,
} from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { fetchReplay, replayBattle } from "@unicum.gg/core/battles/replays";
import { drawing } from "@unicum.gg/core/battles/read";
import { minimapsByArena } from "@unicum.gg/core/wargaming/wot/maps/index";
import { measured } from "@/services/perf";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleReplayResponse, battleReplayQuery } from "./schema.api";

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
const FORMAT = 20;

/**
 * Always revalidate, and the ETag decides.
 *
 * Not a long `max-age`: a battle never changes but the SHAPE of this answer
 * does, and a body cached by time cannot be told it is out of date. The
 * round trip costs a 304 with no body and no decode, which is cheap enough to
 * pay every time for an answer that is never quietly wrong.
 */
const CACHE = { "cache-control": "public, max-age=0, must-revalidate" };

/**
 * The colour the game paints an ally's chat line, read off real replays.
 *
 * The line carries no team field: the client has already resolved the sides at
 * the moment it draws the message, and what it stores is the result. So the
 * colour IS the side, and a line in any other colour is somebody on the other
 * team. Compared against the one value rather than a list, so an unknown colour
 * reads as "not an ally" instead of silently becoming one.
 */
const ALLY_COLOUR = "#80D63A";

/** One vehicle's path, as `[clock ticks, x, z]`, and when it stopped living. */
type Track = {
  id: number;
  /** Which side it fought on, 0 when the results name none. */
  team: number;
  points: [number, number, number][];
  /**
   * The tick this vehicle was destroyed, or null if it survived.
   *
   * In the recording's clock, not the battle's: the two differ by the
   * countdown, about fifty seconds, so handing back the battle figure would
   * grey every wreck a minute early.
   */
  diedAt: number | null;
  /** Hit points at full, so a reader can turn the figures below into a share. */
  maxHealth: number;
  /**
   * Hit points over time, as `[clock ticks, hit points]`, one entry per change.
   *
   * It starts at full and only changes when the recording client was told it
   * had: a vehicle it loses sight of keeps the last value it heard, which is
   * why four of fourteen end above the health the results record. That is the
   * same fog of war the positions have, not a decoding error.
   */
  health: [number, number][];
  /** Where the gun points over time, as `[clock ticks, radians]`. */
  aim: [number, number][];
  /** Where it was while past the recorder's 565 m, as its minimap drew it. */
  far: [number, number, number][];
};

/** A coordinate to a tenth of a metre, which is finer than any map draws. */
const round1 = (value: number) => Math.round(value * 10) / 10;

/** The smallest change of aim worth sending, in radians: about three degrees. */
const AIM_STEP = 0.05;

/**
 * Where a vehicle's gun points over time, from north towards east: the hull's
 * heading plus the turret's angle on it, read at every moment either changed.
 * Only moments both are known count, since one without the other points the
 * gun at nothing in particular.
 */
function aimOf(hull: [number, number][], turret: [number, number][]): [number, number][] {
  const times = [...new Set([...hull, ...turret].map(([at]) => at))].sort((a, b) => a - b);
  const out: [number, number][] = [];
  let h = -1;
  let g = -1;
  for (const at of times) {
    while (h + 1 < hull.length && hull[h + 1][0] <= at) h += 1;
    while (g + 1 < turret.length && turret[g + 1][0] <= at) g += 1;
    if (h < 0 || g < 0) continue;
    let angle = hull[h][1] + turret[g][1];
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    const last = out.at(-1);
    const turned = last ? Math.abs(Math.atan2(Math.sin(angle - last[1]), Math.cos(angle - last[1]))) : Infinity;
    if (turned > AIM_STEP) out.push([Math.round(at * TICKS), Math.round(angle * 1000) / 1000]);
  }
  return out;
}

/**
 * Every `stride` ticks at most, keeping the ends.
 *
 * The first point of each window rather than an average: these are positions,
 * and a vehicle averaged between two moments stands where it never was. The
 * last point is always kept, so a track still finishes where its vehicle did.
 *
 * `stride` of zero hands the points back untouched, which is what the site's
 * own viewer asks for.
 */
function everyNTicks(points: [number, number, number][], stride: number) {
  if (stride <= 0 || points.length < 3) return points;
  const out: [number, number, number][] = [];
  let next = -Infinity;
  for (const point of points) {
    if (point[0] >= next) {
      out.push(point);
      next = point[0] + stride;
    }
  }
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
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
 * @queryParams battleReplayQuery
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

  const query = battleReplayQuery.safeParse(
    Object.fromEntries(new URL(_req.url).searchParams),
  );
  if (!query.success) {
    return Response.json({ error: "invalid_recorder" }, { status: 400 });
  }
  const battle = await replayBattle(
    region as Region,
    normaliseBattleId(id),
    query.data.recorder,
  );
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
  let loadouts: ReplayLoadout[] = [];
  try {
    const { stream } = await readReplay(file);
    if (stream.length === 0) {
      return Response.json({ error: "no_replay" }, { status: 404 });
    }
    motion = readMotion(stream);
    // A second walk over the same stream rather than another branch inside
    // `readMotion`. That function runs for every map that is drawn, and the
    // loadout lives in packets it has no other reason to look at; keeping them
    // apart means a reader who only wants the paths does not pay for the
    // crew, and the walk itself is a rounding error beside the decryption and
    // the inflate that had to happen first.
    loadouts = readLoadouts(stream);
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

  const offset = replayClockOffset(built, battle.vehicles);
  const died = new Map(
    battle.vehicles
      .filter((v) => v.died && v.lifeTime > 0)
      .map((v) => [v.id, v.lifeTime]),
  );
  // How many ticks apart the points handed back are, at the least.
  //
  // The full answer is 730 KB of which 729 is tracks: 48 791 points over 32
  // vehicles, roughly four a second each. The site's viewer wants that -- it
  // scrubs, zooms and interpolates. A caller drawing a small map in a game's
  // results screen does not, and 730 KB is a lot to push through an interface
  // model that was built for a few hundred bytes.
  //
  // `?every=<seconds>` thins them: the first point of each window is kept,
  // plus the last point of the track, so a vehicle still ends where it died.
  // Everything else about the answer is unchanged, so one reader can ask for
  // less without a second route to keep in step with this one.
  const every = Number(new URL(_req.url).searchParams.get("every") ?? 0);
  const stride =
    Number.isFinite(every) && every > 0 ? Math.round(every * TICKS) : 0;

  const teams = new Map(battle.vehicles.map((v) => [v.id, v.team]));
  const health = new Map(motion.health.map((h) => [h.id, h.points]));
  const aims = new Map(motion.tracks.map((t) => [t.id, aimOf(t.hull, t.turret)]));
  const maxHealth = new Map(battle.vehicles.map((v) => [v.id, v.maxHealth]));
  // The minimap's far positions, by vehicle. A vehicle that never came within
  // 565 m of the recorder has nothing else, so it gets a track of its own.
  const farIndex = minimapIndex(
    motion.minimap,
    battle.vehicles.map((v) => v.id),
    motion.tracks.map((t) => ({ id: t.id, points: t.points })),
  );
  const far = new Map<number, [number, number, number][]>();
  if (farIndex) {
    for (const record of motion.minimap) {
      const id = farIndex.get(record.key);
      if (id === undefined) continue;
      const list = far.get(id) ?? [];
      list.push([Math.max(0, Math.round(record.at * TICKS)), record.x, record.z]);
      far.set(id, list);
    }
  }
  for (const id of far.keys()) {
    if (!built.some((track) => track.id === id)) built.push({ id, points: [], last: 0 });
  }
  const tracks: Track[] = built.map((track) => {
    const life = died.get(track.id);
    return {
      id: track.id,
      // Which side, so a reader can colour the dots without the battle's own
      // document. Zero when the results do not name one, which is a vehicle
      // we cannot put on a team rather than team zero.
      team: teams.get(track.id) ?? 0,
      points: everyNTicks(track.points, stride),
      diedAt:
        life !== undefined && offset !== null
          ? Math.round((life + offset) * TICKS)
          : null,
      maxHealth: maxHealth.get(track.id) ?? 0,
      health: (health.get(track.id) ?? []).map(
        ([at, hp]) => [Math.round(at * TICKS), hp] as [number, number],
      ),
      aim: aims.get(track.id) ?? [],
      far: everyNTicks(far.get(track.id) ?? [], stride),
    };
  });
  if (tracks.length === 0) {
    return Response.json({ error: "no_replay" }, { status: 404 });
  }

  // Matched by victim, and by time when a victim appears twice: a vehicle can
  // be reported at zero more than once, and the entry meant is the one next to
  // the death the results recorded.
  const byVictim = new Map<number, typeof motion.kills>();
  for (const kill of motion.kills) {
    const into = byVictim.get(kill.victim) ?? [];
    into.push(kill);
    byVictim.set(kill.victim, into);
  }
  const reasons = new Map(
    battle.vehicles.map((vehicle) => [vehicle.id, vehicle.deathReason]),
  );
  const deaths = tracks
    .filter((track) => track.diedAt !== null)
    .map((track) => {
      const when = (track.diedAt as number) / TICKS;
      const candidates = byVictim.get(track.id) ?? [];
      let best = null as (typeof motion.kills)[number] | null;
      for (const kill of candidates) {
        if (!best || Math.abs(kill.at - when) < Math.abs(best.at - when)) {
          best = kill;
        }
      }
      return {
        at: track.diedAt as number,
        victim: track.id,
        by: best?.by ?? null,
        damage: best?.damage ?? null,
        // The game's own code for how it died, which is what picks the
        // sentence: drowned, rammed, burned, shot.
        reason: reasons.get(track.id) ?? null,
      };
    })
    .sort((a, b) => a.at - b.at);

  return jsonResponse(
    BattleReplayResponse,
    {
      duration: Math.round(motion.duration),
      ticksPerSecond: TICKS,
      // The map and its extent, so a caller can place these positions without
      // resolving the arena itself. The viewer on the site gets them from the
      // battle it already loaded; a caller with nothing but this answer -- the
      // game's own results screen, for one -- would otherwise have to guess a
      // scale from the points, which puts every vehicle slightly wrong.
      ...drawing((await minimapsByArena(region)).get(battle.mapName), battle.gameplayId),
      // When the countdown ends, in this same clock. Before it nothing moves,
      // so a reader of these tracks cannot tell a vehicle standing on its
      // spawn from one nobody can see: positions are only written down when
      // they change.
      startsAt: offset !== null ? Math.round(offset * TICKS) : 0,
      tracks,
      // The recorder's own view range as the server told them, on the same
      // clock. Before the countdown ends it can only be the first value.
      vision: motion.vision.map(
        ([at, radius]) => [Math.max(0, Math.round(at * TICKS)), radius] as [number, number],
      ),
      // When the recorder was spotted, on the same clock: each lit the game's
      // sixth sense for two seconds.
      observed: motion.observed.map((at) => Math.max(0, Math.round(at * TICKS))),
      // The recorder's own state, on the same clock: their rack (shells by
      // their place in it, which is the order the first full list arrives in
      // and the loadout's own), their modules and crew, their battle feed,
      // and what their commander could see of the vehicle they aimed at.
      ...recorderState(motion, TICKS),
      // Every hit this client heard about, with its author, on the same clock.
      hits: motion.hits.map(
        (hit) =>
          [Math.max(0, Math.round(hit.at * TICKS)), hit.by, hit.victim, hit.damage] as [
            number,
            number,
            number,
            number,
          ],
      ),
      // Every shell the recording saw fired, on the same clock as the tracks.
      shots: motion.shots.map((shot) => {
        const to = shot.to ?? unseenShotEnd(shot);
        return {
          at: Math.round(shot.at * TICKS),
          by: shot.by,
          from: [round1(shot.from.x), round1(shot.from.z)] as [number, number],
          to: [round1(to.x), round1(to.z)] as [number, number],
          endAt: shot.endAt === null ? null : Math.round(shot.endAt * TICKS),
          landed: shot.to !== null,
          victim: shot.victim,
          ricochet: shot.ricochet,
        };
      }),
      // What the player who recorded this had fitted, one entry per life.
      //
      // Flattened to the layout that was in USE. The client keeps two groups
      // of setups, each with its own spare layout, and a vehicle can be on its
      // second ammunition layout and its first equipment layout at the same
      // time; publishing both would describe a setup this battle never saw.
      // The garage page shows both deliberately, because there "what else is
      // configured" is a real question. Here it is not.
      //
      // Only ever the recorder's own. The server strips the devices out of
      // every other vehicle's public information before it reaches a client,
      // so there is no second loadout in the file to publish or withhold.
      loadouts: loadouts.map((life: ReplayLoadout) => {
        const ammo = activeLayout(life.setups?.ammo);
        const devices = activeLayout(life.setups?.devices);
        return {
          vehicle: life.entityId,
          at: Math.round(life.at * TICKS),
          optDevices: devices?.optDevices ?? [],
          boosters: devices?.boosters ?? [],
          consumables: ammo?.consumables ?? [],
          shells: (ammo?.shells ?? []).map((shell) => ({
            name: shell.name,
            type: shell.type,
            premium: shell.premium,
            count: shell.count,
          })),
          crew: (life.crew ?? []).map((member) => ({
            role: member.role,
            skills: member.skills,
          })),
        };
      }),
      // Every death, with whoever caused it where the recording heard who.
      //
      // The WHEN comes from `diedAt`, which is the battle's own results and so
      // knows about a tank nobody watched die; the WHO comes from the packet,
      // which only speaks for what the recording client could see. Taking the
      // better half of each rather than one or the other is why this is built
      // here and not in the parser: only this function holds both.
      deaths,
      // What was typed, in the clock the rest of this answer uses.
      //
      // Published on the site owner's explicit decision, twice stated. It is
      // worth being plain about what it is: thirty people agreed to play a
      // battle, not to have their messages republished, and unlike a position
      // this is not something the game already shows to anyone who looks. The
      // parser hands it over as plain strings with the game's own markup taken
      // apart, so nothing a player typed is ever rendered as HTML.
      chat: motion.chat.map((line: ChatLine) => ({
        at: Math.round(line.at * TICKS),
        from: line.from,
        vehicle: line.vehicle,
        text: line.text,
        ally: line.colour === ALLY_COLOUR,
        command: line.command ?? null,
        // Handed over unresolved. On a real recording it is the sender's
        // VEHICLE id, the same id the tracks carry, but not for every command:
        // a waypoint's ran to nineteen digits and is plainly something else.
        // So the check is "does this name somebody in this battle", and the
        // list to check against is on the page, not here.
        sender: line.sender ?? null,
        // The message's own placeholders travel with it, unfilled: `%(target)s`
        // needs a name, and the names are on the page. Rounded here because a
        // reload of 4.9173 seconds is a reload of 5.
        target: line.target ?? null,
        reloadTime:
          line.reloadTime != null ? Math.round(line.reloadTime) : null,
        label: line.label ?? null,
        // Rounded like every other coordinate here: half a metre is already
        // under a pixel on a minimap.
        where: line.where
          ? { x: Math.round(line.where.x), z: Math.round(line.where.z) }
          : null,
      })),
    },
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

/** A clock in seconds to ticks, never before the stream's start. */
const tickOf = (at: number, ticks: number) => Math.max(0, Math.round(at * ticks));

/**
 * The recorder's rack, modules, battle feed and view of their target, shaped
 * for the page. Shells are numbered by their place in the rack, in the order
 * the client first lists them, which is the loadout's own; consumables are
 * left out, since only their use would say anything and the loadout already
 * names them.
 */
function recorderState(motion: ReturnType<typeof readMotion>, ticks: number) {
  const slots: number[] = [];
  const ammo: [number, number, number][] = [];
  for (const entry of motion.ammo) {
    if ((entry.item & 0xf) !== 10) continue;
    let slot = slots.indexOf(entry.item);
    if (slot < 0) slot = slots.push(entry.item) - 1;
    ammo.push([tickOf(entry.at, ticks), slot, entry.quantity]);
  }
  return {
    ammo,
    ownDamage: motion.ownDamage.map(
      (entry) => [tickOf(entry.at, ticks), entry.extra, entry.code] as [number, number, number],
    ),
    events: motion.events
      .filter((event) => FEED_TYPES.has(event.type))
      .map(
        (event) =>
          // A critical hit carries a count of hits rather than hit points.
          [
            tickOf(event.at, ticks),
            event.type,
            event.target,
            event.type === 6 || event.type === 9 ? event.crits : event.amount,
          ] as [
            number,
            number,
            number,
            number,
          ],
      ),
    targetDamage: motion.targetDamage.map((entry) => ({
      at: tickOf(entry.at, ticks),
      vehicle: entry.vehicle,
      damaged: entry.damaged,
      destroyed: entry.destroyed,
    })),
  };
}

/** The feed events the page uses: damage dealt and received, the three
 * assists, blocked, and the critical hits either way. */
const FEED_TYPES = new Set([1, 2, 5, 6, 7, 9, 10, 11]);
