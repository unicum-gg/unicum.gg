/**
 * Where a Maneuvers reward line (the Fame Points the last vehicle or gold place
 * costs) will sit when the edition ends.
 *
 * The line does not grow with the clock. Maneuvers battles are only fought in
 * the event's evening windows, so the board moves for four or five hours and
 * then holds still until the next evening: on EU in autumn 2026 it went from
 * 502 to 1,015 over one evening and did not move again for seventeen hours. A
 * curve fitted through every capture would spend most of its points on those
 * flat nights, so this reads one value per EVENING, the line as that evening
 * left it, and works from those.
 *
 * What it does with them is carry the evenings' pace forward, not fit a curve.
 * This was Onslaught's square root of the days played first, and the autumn
 * 2026 edition measured it wrong: on EU the vehicle line gained 581, 572, 573,
 * 589 and 665 over five evenings, and the gold line 3,000 to 3,500 each, with
 * no slowing at all. The square root expects the gains to shrink, so every
 * evening beat it and the projection was revised upward every day (6,100, then
 * 6,459, then 6,864) with even its high bound below the straight line. Unlike
 * Onslaught, whose line chases a few hundred places, this one sits deep in a
 * board of tens of thousands who all play the same windows, and points only add
 * up.
 *
 * The pace is the last three evenings', not the whole edition's, because the
 * line can also speed up. Over the second week the same vehicle line gained
 * 693, 726, 734, 734 and 740, and the edition-wide mean trailed it: replayed,
 * it missed the line three evenings out by 3.7% where the last three missed by
 * 1.5%, while the gold line, which never sped up, came out the same either way.
 * Fitting a trend through the gains was tried too and swung by 45% on the gold
 * line in the first week. Nothing is projected before
 * `MANEUVERS_FORECAST_MIN_EVENINGS` watched evenings. The range is at least the
 * distance still to travel give or take `RANGE_SHARE`, which is what that replay
 * missed by six evenings out, and wider when the evenings the pace is read from
 * spread further. The first week still cannot see a second week's speed-up: a
 * week out, the vehicle line ended 18% of the distance above the projection.
 */

const HOUR_SECONDS = 3_600;
const DAY_SECONDS = 86_400;

/** A stretch this long with the line unchanged ends an evening. Longer than
 * any pause inside a window, shorter than the gap between two windows. */
const EVENING_GAP_SECONDS = 6 * HOUR_SECONDS;

/** How long the line must be seen holding still after an evening's last move
 * before that move counts as the evening's end: without it, a feeder that died
 * mid-evening would leave its last capture posing as a final figure. */
const SETTLED_SECONDS = 2 * HOUR_SECONDS;

/** Complete evenings, each seen moving, before a projection is published. */
export const MANEUVERS_FORECAST_MIN_EVENINGS = 3;

/** How many of the latest gains the pace is the mean of. */
const PACE_EVENINGS = 3;

/** The least share of the distance still to travel the range spans each way. */
const RANGE_SHARE = 0.15;

export type ManeuversCutoffSample = { t: number; cutoff: number | null };

export type ManeuversEvening = {
  /** Unix seconds of the last move seen that evening. */
  t: number;
  /** The line as the evening left it. */
  points: number;
  /** Whether we watched it move, and so know when it ended. An evening first
   * seen after the feeder was down shows only where it finished. */
  watched: boolean;
};

export type ManeuversCutoffForecast = {
  /** Complete evenings, oldest first. */
  evenings: ManeuversEvening[];
  /** What the last complete evening added, null without one before it. */
  lastEveningGain: number | null;
  /** The line now, as the board last published it. */
  now: number | null;
  /** Null until enough evenings are watched, or without an end date. */
  projection: { points: number; low: number; high: number; at: number } | null;
};

/**
 * The evenings in a series of captures: each change of the line starts or
 * extends one, and a long stretch without a change closes it. The evening still
 * being played is left out, since its figure is not final.
 */
export function maneuversEvenings(samples: ManeuversCutoffSample[]): ManeuversEvening[] {
  const known = samples
    .filter((s): s is { t: number; cutoff: number } => s.cutoff != null)
    .sort((a, b) => a.t - b.t);
  const last = known.at(-1);
  if (!last) return [];

  const evenings: ManeuversEvening[] = [];
  let open: Open | null = null;
  let previous: { t: number; cutoff: number } | null = null;
  for (const s of known) {
    const changed = previous == null || s.cutoff !== previous.cutoff;
    if (changed) {
      if (open && s.t - open.t > EVENING_GAP_SECONDS) {
        evenings.push(close(open));
        open = null;
      }
      if (!open) {
        open = {
          t: s.t,
          points: s.cutoff,
          moves: 0,
          lastSeen: s.t,
          // A first sight after a capture gap says where the line stood, not
          // when it got there.
          seenAfterGap: previous == null || s.t - previous.t > EVENING_GAP_SECONDS,
        };
      } else {
        open.t = s.t;
        open.points = s.cutoff;
        open.moves += 1;
        open.lastSeen = s.t;
      }
    } else if (open) {
      open.lastSeen = s.t;
    }
    previous = s;
  }
  // The open evening counts once the line has held still long enough since.
  if (open && last.t - open.t > EVENING_GAP_SECONDS) evenings.push(close(open));
  return evenings;
}

type Open = {
  t: number;
  points: number;
  moves: number;
  /** The last capture still showing this evening's value. */
  lastSeen: number;
  seenAfterGap: boolean;
};

function close(open: Open): ManeuversEvening {
  return {
    t: open.t,
    points: open.points,
    watched:
      (open.moves > 0 || !open.seenAfterGap) && open.lastSeen - open.t >= SETTLED_SECONDS,
  };
}

/**
 * The line's evenings, the last one's gain, and where it ends up.
 *
 * The pace is a gain per day between two watched evenings, so a night the
 * feeder missed divides over the days it spans instead of reading as one huge
 * evening. The evenings still to come are the whole days between the last one
 * and the end, each window closing about a day after the one before.
 */
export function maneuversCutoffForecast(
  samples: ManeuversCutoffSample[],
  editionStart: number | null,
  editionEnd: number | null,
): ManeuversCutoffForecast {
  const evenings = maneuversEvenings(samples);
  const now =
    [...samples].reverse().find((s) => s.cutoff != null)?.cutoff ?? null;
  const lastTwo = evenings.slice(-2);
  const lastEveningGain =
    lastTwo.length === 2 ? lastTwo[1].points - lastTwo[0].points : null;

  const watched = evenings.filter((e) => e.watched);
  const last = evenings.at(-1);
  if (
    watched.length < MANEUVERS_FORECAST_MIN_EVENINGS ||
    editionStart == null ||
    editionEnd == null ||
    now == null ||
    !last
  ) {
    return { evenings, lastEveningGain, now, projection: null };
  }

  const paces: number[] = [];
  for (let i = 1; i < watched.length; i++) {
    const days = Math.max(1, Math.round((watched[i].t - watched[i - 1].t) / DAY_SECONDS));
    paces.push(Math.max(0, watched[i].points - watched[i - 1].points) / days);
  }
  const recent = paces.slice(-PACE_EVENINGS);
  const pace = recent.reduce((a, b) => a + b, 0) / recent.length;
  const remaining = Math.max(0, Math.floor((editionEnd - last.t) / DAY_SECONDS));

  // Anchored on the line the board shows, so the forecast never argues with the
  // figure beside it. An evening in progress is already part of `now`, which is
  // why it is a floor rather than the base.
  const at = (perEvening: number) =>
    Math.round(Math.max(now, last.points + perEvening * remaining));
  return {
    evenings,
    lastEveningGain,
    now,
    projection: {
      points: at(pace),
      low: at(Math.min(...recent, pace * (1 - RANGE_SHARE))),
      high: at(Math.max(...recent, pace * (1 + RANGE_SHARE))),
      at: editionEnd,
    },
  };
}
