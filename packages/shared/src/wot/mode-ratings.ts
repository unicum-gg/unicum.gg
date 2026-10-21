import { RatingColor } from "./ratings";

/**
 * MR, the per-mode performance rating, and MRB, its volume-rewarding sibling.
 *
 * Wargaming answers a statistics block per battle mode, and none of the WN
 * ratings can read them: all three are built against expected damage measured
 * in random battles, so a Skirmish is scored as a random battle nobody could
 * have played (1,794 WNX against 4,708 on one vehicle, at 89.5% wins against
 * 71.9%). So the modes carried no rating at all and their columns came off
 * rather than dashing.
 *
 * MR is what fills that hole. It reads two axes, each against the median of the
 * MODE'S OWN population rather than against a random-battle expectation:
 *
 * - **average XP per battle**, the single effectiveness signal, since the
 *   game's own XP formula already folds in damage, frags, spotting and survival
 *   time. Separate damage and frag axes would double-count what XP already
 *   carries.
 * - **the win rate**, the outcome.
 *
 * Equally weighted, then multiplied by a volume brake so a hundred-battle
 * sample cannot top a board, and finally divided by the mode's own median
 * score so that **1000 means median in every mode**. That last division is
 * the part that makes the number comparable, and it was measured rather than
 * assumed: normalising the two axes alone leaves the median score running from
 * 893 in Clan Wars VI to 1300 in Skirmish, purely because the brake reads a
 * battle count and the modes are played in wildly different volumes. A shared
 * colour scale over that paints an average Skirmish player green and an
 * average Rampage player orange for the same relative standing.
 *
 * What it is NOT is comparable to WN8 or WNX. Those answer "how does this
 * player compare to the whole playerbase at this vehicle"; MR answers "how does
 * this player compare to the people who play this mode", which is a different
 * and smaller question. A mode nobody good plays has a low bar and MR says
 * nothing about that, by construction.
 */
export enum RatedMode {
  Skirmish = "skirmish",
  Advances = "fortified",
  GrandBattles = "epic",
  ClanWarsX = "cw_absolute",
  ClanWarsVIII = "cw_champion",
  ClanWarsVI = "cw_middle",
  /**
   * The 2015 Rampage event, which Wargaming's API carries as
   * `statistics.fallout` and which the site labelled Steel Hunter for years.
   * They are two different modes four years apart: Rampage ran from update 9.10
   * (September 2015) to 9.15 (May 2016) on ordinary tier VIII to X vehicles,
   * and its two battle types were Domination and "Steel Hunt", which is the one
   * letter the mislabel turned on. Steel Hunter is the battle royale on eight
   * dedicated vehicles, and Wargaming publishes no statistics for it at all:
   * those eight carry zero rows in every mode block we store.
   *
   * The enum member is named for the mode, the value stays the API's column
   * prefix. See `RAMPAGE_MULTI_VEHICLE`.
   */
  Rampage = "fallout",
}

export const RATED_MODES: readonly RatedMode[] = Object.values(RatedMode);

/**
 * `ranked` is deliberately absent, and it is the one mode excluded for a reason
 * that is not ours: the block exists, is documented, and answers null for
 * everybody. Measured over a 400,000-account sample, zero accounts carry a
 * `ranked_battles` figure, which matches Wargaming's own reference marking the
 * field "Warning. The field will be disabled.". A rating computed from it would
 * be null on every row.
 */
export function isRatedMode(v: string): v is RatedMode {
  return (RATED_MODES as readonly string[]).includes(v);
}

export type ModeRatingAnchors = {
  /** The mode's median average XP per battle. */
  xpBase: number;
  /** The mode's median win rate, as a fraction. */
  wrBase: number;
  /** The mode's median braked score, which puts its median player at 1000. */
  scoreBase: number;
};

/**
 * The anchors, measured per mode on EU.
 *
 * Population: the latest snapshot of each of 400,000 accounts, keeping those
 * with at least `MR_MIN_BATTLES` battles in the mode, which is the same gate
 * the boards apply. The sample sizes below are the rows each median was taken
 * over.
 *
 * | mode | rows | xpBase | wrBase | scoreBase |
 * |---|---|---|---|---|
 * | Skirmish | 141,381 | 569 | 47.66% | 0.8666 |
 * | Advances | 69,041 | 685 | 48.29% | 0.8074 |
 * | Clan Wars X | 62,731 | 679 | 48.78% | 0.7580 |
 * | Grand Battles | 53,759 | 700 | 46.09% | 0.6763 |
 * | Clan Wars VIII | 24,726 | 619 | 50.47% | 0.6541 |
 * | Clan Wars VI | 6,700 | 477 | 53.21% | 0.5953 |
 * | Rampage | 4,090 | 1079 | 42.23% | 0.6353 |
 *
 * Two of those numbers say something about the modes rather than about the
 * formula. The three Clan Wars win rates sit ABOVE 50% and climb as the tier
 * falls, because a Global Map landing is often uncontested. And Rampage is the
 * only mode under 46%, at 42.23%, which is what multi-team battles look like:
 * one team of several wins, so the population cannot average 50%. The site used
 * to explain that figure as "a top-5 finish in battle royale", which was a
 * story written to fit a number whose real cause is in the mode's own rules.
 *
 * They are constants rather than a nightly recompute on purpose. A rating whose
 * scale moves under the reader cannot be compared to the value they saw
 * yesterday, and these medians are stable: Rampage's are frozen by
 * construction, and the live modes' moved by about 1% between two independently
 * drawn samples.
 */
export const MODE_RATING_ANCHORS: Record<RatedMode, ModeRatingAnchors> = {
  [RatedMode.Skirmish]: { xpBase: 569, wrBase: 0.4766, scoreBase: 0.8666 },
  [RatedMode.Advances]: { xpBase: 685, wrBase: 0.4829, scoreBase: 0.8074 },
  [RatedMode.GrandBattles]: { xpBase: 700, wrBase: 0.4609, scoreBase: 0.6763 },
  [RatedMode.ClanWarsX]: { xpBase: 679, wrBase: 0.4878, scoreBase: 0.758 },
  [RatedMode.ClanWarsVIII]: { xpBase: 619, wrBase: 0.5047, scoreBase: 0.6541 },
  [RatedMode.ClanWarsVI]: { xpBase: 477, wrBase: 0.5321, scoreBase: 0.5953 },
  [RatedMode.Rampage]: { xpBase: 1079, wrBase: 0.4223, scoreBase: 0.6353 },
};

/** Board and rating gate: fewer battles than this in a mode and MR is null. */
export const MR_MIN_BATTLES = 100;

/** Where the median of every mode lands. */
export const MR_SCALE = 1000;

/** Half volume-credit at this many battles. */
export const MR_VOLUME_K = 100;

export const MR_W_XP = 0.5;
export const MR_W_WIN = 0.5;

export type MRInputs = {
  battles: number;
  wins: number;
  avgXp: number;
};

/**
 * The braked effectiveness score, before the mode's median divides it.
 *
 * Exported because the leaderboards evaluate the same expression in SQL over
 * cached per-mode totals rather than calling this per row, so both sides read
 * one set of constants instead of each keeping a copy of the formula.
 */
export function modeScore(mode: RatedMode, s: MRInputs): number {
  const a = MODE_RATING_ANCHORS[mode];
  const rXp = s.avgXp / a.xpBase;
  const rWin = s.wins / s.battles / a.wrBase;
  const vol = s.battles / (s.battles + MR_VOLUME_K);
  return (MR_W_XP * rXp + MR_W_WIN * rWin) * vol;
}

/** The mode rating, or null when the player has no battle in the mode. */
export function computeMR(mode: RatedMode, s: MRInputs): number | null {
  if (!s.battles || s.battles <= 0) return null;
  const mr = (MR_SCALE * modeScore(mode, s)) / MODE_RATING_ANCHORS[mode].scoreBase;
  return Number.isFinite(mr) ? Math.round(mr) : null;
}

/**
 * One colour ladder for every mode, which the median normalisation is what
 * earns.
 *
 * Calibrated on the pooled distribution of the seven modes above (362,427
 * rows), by population percentile so each band keeps the rarity the site's
 * other scales give it: p02, p07, p20, p60, p85, p95, p98, p99. Pooling is only
 * honest because the shapes agree once the medians are aligned, which was
 * measured: p85/p50 runs 1.27 to 1.37 across the seven and p95/p50 runs 1.41 to
 * 1.56. The lower tail is the looser half (p01 from 352 in Skirmish to 621 in
 * Grand Battles), so the bottom band is wider in some modes than in others,
 * which costs a reader nothing that "very bad" did not already say.
 *
 * The thresholds land within about 1% of the ones the old Rampage-only ladder
 * used from Average up (1070, 1300, 1500, 1620, 1720 against 1080, 1310, 1490,
 * 1610, 1700), so the colours on that board barely move even though its values
 * are now mode-relative.
 */
export function mrColor(value: number): RatingColor {
  if (value < 460) return RatingColor.VeryBad;
  if (value < 590) return RatingColor.Bad;
  if (value < 750) return RatingColor.BelowAvg;
  if (value < 1080) return RatingColor.Average;
  if (value < 1310) return RatingColor.Good;
  if (value < 1490) return RatingColor.VeryGood;
  if (value < 1610) return RatingColor.Super;
  if (value < 1700) return RatingColor.Excellent;
  return RatingColor.Top;
}

/** How far each band sits from the mode's own median win rate. */
const WR_OFFSETS = [-0.06, -0.04, -0.02, 0.02, 0.05, 0.08, 0.12, 0.17];

/** The win-rate grid the API publishes these scales on (`RatingScale`'s
 * `precision` for a percentage). */
const WR_PRECISION = 4;

/**
 * The ladder per mode, snapped to that grid rather than left as the float sum.
 *
 * `0.4223 - 0.04` is `0.38229999999999997` in binary floating point, which is a
 * threshold no four-decimal value lands on, and that is not cosmetic here:
 * `ratingScale` derives a published scale by bisecting one of these functions
 * and snapping each boundary onto the same grid, so an off-grid threshold makes
 * the snapped boundary fall back BELOW it. The colour then never advances, the
 * search returns the same boundary forever, and the scale comes back with a
 * band duplicated eight times instead of nine distinct ones. Every other colour
 * ladder on the site is written as grid literals (0.35, 0.4, 0.53) and so never
 * met this; these are computed, so they have to be snapped. Found by deriving
 * the Rampage board's own table from this function rather than hand-keeping it.
 */
const WR_THRESHOLDS: Record<RatedMode, number[]> = Object.fromEntries(
  RATED_MODES.map((mode) => [
    mode,
    WR_OFFSETS.map((offset) =>
      Number((MODE_RATING_ANCHORS[mode].wrBase + offset).toFixed(WR_PRECISION)),
    ),
  ]),
) as Record<RatedMode, number[]>;

/** The nine colours, darkest first, matching `WR_THRESHOLDS` ascending. */
const WR_COLORS = [
  RatingColor.VeryBad,
  RatingColor.Bad,
  RatingColor.BelowAvg,
  RatingColor.Average,
  RatingColor.Good,
  RatingColor.VeryGood,
  RatingColor.Super,
  RatingColor.Excellent,
  RatingColor.Top,
];

/**
 * A mode's win rate against its own population, rather than against 50%.
 *
 * Reusing the random-battle `winrateColor` would paint the whole Rampage board
 * red for sitting where its rules put it (42.2%, because its battles were
 * multi-team and one team of several won), and would paint Clan Wars VI green
 * for the same reason in reverse (53.2%, because a Global Map landing is often
 * uncontested).
 */
export function modeWinrateColor(mode: RatedMode, wr: number): RatingColor {
  const thresholds = WR_THRESHOLDS[mode];
  for (let i = 0; i < thresholds.length; i++) {
    if (wr < thresholds[i]) return WR_COLORS[i];
  }
  return RatingColor.Top;
}

/**
 * MRB, the same effectiveness score with battle volume REWARDED instead of
 * braked: `ln(1 + battles/50)` in place of `battles/(battles+100)`.
 *
 * **Rampage only, and the reason it is not rolled out is that its stated
 * justification turned out to be false.** It was written as "winning is very
 * hard in battle royale, so winning AND playing a lot is the real feat", about
 * a mode this block never held. What is actually true of Rampage is that its
 * win rate is low because battles were multi-team, which is an argument about
 * the win-rate anchor and not about rewarding volume.
 *
 * It is kept because it is a sortable column on a board that has been published
 * for months, and removing a column is a decision about the product rather than
 * about the data. It is not generalised because the volume term amplifies each
 * mode's battle-count distribution rather than normalising it: aligning the
 * medians still leaves p85/p50 running 1.33 in Clan Wars VI against 1.64 in
 * Skirmish, so one ladder over all seven would not be honest the way `mrColor`
 * is.
 */
export const MRB_VOLUME_K = 50;

/** The median MRB score on Rampage, so its median player lands at 1000 too. */
export const MRB_SCORE_BASE = 1.5081;

export function computeMRB(s: MRInputs): number | null {
  if (!s.battles || s.battles <= 0) return null;
  const a = MODE_RATING_ANCHORS[RatedMode.Rampage];
  const rXp = s.avgXp / a.xpBase;
  const rWin = s.wins / s.battles / a.wrBase;
  const vol = Math.log(1 + s.battles / MRB_VOLUME_K);
  const mrb =
    (MR_SCALE * (MR_W_XP * rXp + MR_W_WIN * rWin) * vol) / MRB_SCORE_BASE;
  return Number.isFinite(mrb) ? Math.round(mrb) : null;
}

/**
 * Calibrated on the Rampage MRB distribution (4,090 rows; p50 1000, p85 1590,
 * p95 2044, p98 2371, p99 2547, max 3602), by the same percentiles as
 * `mrColor`. Wider than MR because the volume reward spreads the top, hence its
 * own ladder rather than a reuse.
 */
export function mrbColor(value: number): RatingColor {
  if (value < 540) return RatingColor.VeryBad;
  if (value < 645) return RatingColor.Bad;
  if (value < 760) return RatingColor.BelowAvg;
  if (value < 1120) return RatingColor.Average;
  if (value < 1590) return RatingColor.Good;
  if (value < 2040) return RatingColor.VeryGood;
  if (value < 2370) return RatingColor.Super;
  if (value < 2550) return RatingColor.Excellent;
  return RatingColor.Top;
}

/**
 * A Rampage battle counts on every vehicle fielded, so the per-vehicle sum runs
 * 1.6x to 2.6x over the account's own figure (896 against 380 on one account,
 * 26,380 against 10,128 on the heaviest we track). The event let a lineup
 * respawn, which is also why its average XP per battle is the highest of any
 * mode we rate (1079 against 477 to 700 elsewhere): one battle accrued the XP
 * of several vehicles.
 */
export const RAMPAGE_MULTI_VEHICLE = true;
