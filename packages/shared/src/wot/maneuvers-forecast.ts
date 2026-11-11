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
 * left it, and fits through those.
 *
 * The fit is Onslaught's (`fitCutoffCurve`): the line grows as the square root
 * of the days played, which there was measured to beat a straight line by a
 * factor of seven at a week's range. Whether it holds for Maneuvers is not
 * measured yet, which is why nothing is projected before
 * `MANEUVERS_FORECAST_MIN_EVENINGS` complete evenings, and why the projection
 * carries a range rather than one figure.
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
 * Only watched evenings enter the fit, since an evening seen only after the
 * fact has a value but no time. The range widens with how little has been seen:
 * half the growth still to come either way at three evenings, narrowing as the
 * square root of the evenings past that.
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
  if (
    watched.length < MANEUVERS_FORECAST_MIN_EVENINGS ||
    editionStart == null ||
    editionEnd == null ||
    now == null
  ) {
    return { evenings, lastEveningGain, now, projection: null };
  }

  const xs = watched.map((e) => Math.sqrt(Math.max(0, (e.t - editionStart) / DAY_SECONDS)));
  const ys = watched.map((e) => e.points);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < xs.length; i++) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY);
    variance += (xs[i] - meanX) ** 2;
  }
  const growth = variance > 0 ? Math.max(0, covariance / variance) : 0;

  // Anchored on the line the board shows, like the Onslaught projection, so
  // the forecast never argues with the figure beside it: what is projected is
  // the distance still to travel.
  const lastWatched = watched[watched.length - 1];
  const fitted = (at: number) =>
    growth * Math.sqrt(Math.max(0, (at - editionStart) / DAY_SECONDS));
  const ahead = Math.max(0, fitted(editionEnd) - fitted(lastWatched.t));
  const spread =
    0.5 / Math.sqrt(watched.length - MANEUVERS_FORECAST_MIN_EVENINGS + 1);
  const base = Math.max(now, lastWatched.points);
  return {
    evenings,
    lastEveningGain,
    now,
    projection: {
      points: Math.round(base + ahead),
      low: Math.round(base + ahead * (1 - spread)),
      high: Math.round(base + ahead * (1 + spread)),
      at: editionEnd,
    },
  };
}
