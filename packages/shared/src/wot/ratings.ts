import { iconUrl } from "./assets";
import type { VehicleMeta } from "./tanks/meta";
import type { TankStats } from "./tank-stats";

export enum RatingColor {
  VeryBad = "veryBad",
  Bad = "bad",
  BelowAvg = "belowAvg",
  Average = "average",
  Good = "good",
  VeryGood = "veryGood",
  Super = "super",
  Excellent = "excellent",
  Top = "top",
}

export const RATING_COLOR_HEX: Record<RatingColor, string> = {
  [RatingColor.VeryBad]: "#000000",
  [RatingColor.Bad]: "#CD3333",
  [RatingColor.BelowAvg]: "#D77900",
  [RatingColor.Average]: "#D7B600",
  [RatingColor.Good]: "#6D9521",
  [RatingColor.VeryGood]: "#4C762E",
  [RatingColor.Super]: "#4A92B7",
  [RatingColor.Excellent]: "#83579D",
  [RatingColor.Top]: "#5A3175",
};

// Hardcoded as literal strings so Tailwind's JIT scanner sees the
// arbitrary `bg-[#...]` classes at build time. Keep in sync with
// RATING_COLOR_HEX above.
export const RATING_COLOR_CLASS: Record<RatingColor, string> = {
  [RatingColor.VeryBad]: "bg-[#000000]! text-white",
  [RatingColor.Bad]: "bg-[#CD3333]! text-white",
  [RatingColor.BelowAvg]: "bg-[#D77900]! text-white",
  [RatingColor.Average]: "bg-[#D7B600]! text-white",
  [RatingColor.Good]: "bg-[#6D9521]! text-white",
  [RatingColor.VeryGood]: "bg-[#4C762E]! text-white",
  [RatingColor.Super]: "bg-[#4A92B7]! text-white",
  [RatingColor.Excellent]: "bg-[#83579D]! text-white",
  [RatingColor.Top]: "bg-[#5A3175]! text-white",
};

// Onslaught (Competitive 7) leaderboard tiers, using the game's own rank names.
// The client's `leaderboard_page.py` tags each row `Legend` (rank/sixth) when its
// position is within the elite cutoff, else `Champion` (rank/fifth): the top
// `elitePosition` ranks are Legend, the rest of the ranked population (down to
// `masterPosition`, as far as the public board reaches) are Champion. The
// `elite`/`master` in the source thresholds are the rating milestones behind
// those positions, not the displayed tier names. Position-based, so the tier
// means the same across regions even though the raw rating scale differs wildly.
export enum OnslaughtTier {
  Legend = "legend",
  Champion = "champion",
}

export const ONSLAUGHT_TIER_LABEL: Record<OnslaughtTier, string> = {
  [OnslaughtTier.Legend]: "Legend",
  [OnslaughtTier.Champion]: "Champion",
};

export const ONSLAUGHT_TIER_COLOR: Record<OnslaughtTier, RatingColor> = {
  [OnslaughtTier.Legend]: RatingColor.Top,
  [OnslaughtTier.Champion]: RatingColor.Super,
};

export function onslaughtTier(
  rank: number,
  thresholds: {
    elitePosition: number | null;
    masterPosition: number | null;
  },
): OnslaughtTier | null {
  const { elitePosition, masterPosition } = thresholds;
  if (elitePosition != null && rank <= elitePosition)
    return OnslaughtTier.Legend;
  if (masterPosition != null && rank <= masterPosition)
    return OnslaughtTier.Champion;
  return null;
}

// The rank ladder's ordinal filename each tier's icon lives under in the client
// GUI (Iron/Bronze/Silver/Gold/Champion/Legend = first..sixth); the leaderboard
// only ever shows Champion (fifth) and Legend (sixth).
const ONSLAUGHT_RANK_ORDINAL: Record<OnslaughtTier, string> = {
  [OnslaughtTier.Legend]: "sixth",
  [OnslaughtTier.Champion]: "fifth",
};

// The available icon sizes (px) under the client's comp7 rank-icon folder.
export const ONSLAUGHT_RANK_ICON_SIZES = [
  22, 40, 48, 64, 84, 110, 150, 200, 260, 320, 420, 600,
] as const;

/** URL of a rank's icon from the wot.assets mirror. `seasonOrdinal` selects that
 * season's themed art (the plain default is used when it is null); `assetsRef`
 * pins the art to a mirror commit (a past season's art as it was while live),
 * defaulting to the live branch. `size` is one of `ONSLAUGHT_RANK_ICON_SIZES`. */
export function onslaughtRankIcon(
  tier: OnslaughtTier,
  seasonOrdinal: string | null,
  assetsRef: string | null,
  size: (typeof ONSLAUGHT_RANK_ICON_SIZES)[number] = 84,
): string {
  const base = seasonOrdinal
    ? `comp7/ranks/${seasonOrdinal}`
    : "comp7/ranks";
  return iconUrl(
    `${base}/${size}/${ONSLAUGHT_RANK_ORDINAL[tier]}.png`,
    assetsRef ?? undefined,
  );
}

export function winrateColor(wr: number): RatingColor {
  if (wr < 0.45) return RatingColor.VeryBad;
  if (wr < 0.47) return RatingColor.Bad;
  if (wr < 0.49) return RatingColor.BelowAvg;
  if (wr < 0.52) return RatingColor.Average;
  if (wr < 0.54) return RatingColor.Good;
  if (wr < 0.56) return RatingColor.VeryGood;
  if (wr < 0.6) return RatingColor.Super;
  if (wr < 0.65) return RatingColor.Excellent;
  return RatingColor.Top;
}

// Stronghold (skirmish + advances) win rate anchors 50% at Good, which
// matches the reality of organised 7v7/15v15 play far better than the
// random-battle `winrateColor` scale. Same 9 tiers, with 45/40 below Good
// and 55/60 above it, plus VeryBad/VeryGood/Top filling out the extremes.
export function strongholdWinrateColor(wr: number): RatingColor {
  if (wr < 0.35) return RatingColor.VeryBad;
  if (wr < 0.4) return RatingColor.Bad;
  if (wr < 0.45) return RatingColor.BelowAvg;
  if (wr < 0.5) return RatingColor.Average;
  if (wr < 0.53) return RatingColor.Good;
  if (wr < 0.55) return RatingColor.VeryGood;
  if (wr < 0.6) return RatingColor.Super;
  if (wr < 0.65) return RatingColor.Excellent;
  return RatingColor.Top;
}

export function wn7Color(value: number): RatingColor {
  if (value < 500) return RatingColor.VeryBad;
  if (value < 700) return RatingColor.Bad;
  if (value < 900) return RatingColor.BelowAvg;
  if (value < 1100) return RatingColor.Average;
  if (value < 1350) return RatingColor.Good;
  if (value < 1550) return RatingColor.VeryGood;
  if (value < 1850) return RatingColor.Super;
  if (value < 2050) return RatingColor.Excellent;
  return RatingColor.Top;
}

export function wn8Color(value: number): RatingColor {
  if (value < 300) return RatingColor.VeryBad;
  if (value < 600) return RatingColor.Bad;
  if (value < 900) return RatingColor.BelowAvg;
  if (value < 1250) return RatingColor.Average;
  if (value < 1600) return RatingColor.Good;
  if (value < 1900) return RatingColor.VeryGood;
  if (value < 2350) return RatingColor.Super;
  if (value < 2900) return RatingColor.Excellent;
  return RatingColor.Top;
}

// Thresholds calibrated against tomato.gg/wnx's 24-step gradient,
// mapped onto our 9 RatingColor buckets (matching their color zones).
export function wnxColor(value: number): RatingColor {
  if (value < 200) return RatingColor.VeryBad;
  if (value < 400) return RatingColor.Bad;
  if (value < 800) return RatingColor.BelowAvg;
  if (value < 1200) return RatingColor.Average;
  if (value < 1600) return RatingColor.Good;
  if (value < 1800) return RatingColor.VeryGood;
  if (value < 2200) return RatingColor.Super;
  if (value < 2800) return RatingColor.Excellent;
  return RatingColor.Top;
}

export type WN7Inputs = {
  battles: number;
  wins: number;
  frags: number;
  damageDealt: number;
  spotted: number;
  droppedCapturePoints: number;
};

/**
 * Battle-weighted WN7 accumulator. Same split rationale as {@link WN8Acc}. WN7
 * needs the roster's average tier, so it tracks `tierWeighted`/`metaBattles`
 * SEPARATELY from `battles`: the raw stat sums include tanks with no
 * encyclopedia meta (battles still count toward damage/frags/…), but the average
 * tier is only defined over tanks we have a tier for, exactly how the old
 * `computeAvgTier(tanks)` denominator differed from the WN7 battle sum.
 */
export type WN7Acc = {
  battles: number;
  wins: number;
  frags: number;
  damage: number;
  spotted: number;
  droppedCap: number;
  tierWeighted: number;
  metaBattles: number;
};

export function wn7AccZero(): WN7Acc {
  return {
    battles: 0, wins: 0, frags: 0, damage: 0, spotted: 0, droppedCap: 0,
    tierWeighted: 0, metaBattles: 0,
  };
}

export function wn7AccAdd(
  acc: WN7Acc,
  tank: TankStats,
  encyclopedia: Record<string, VehicleMeta>,
): void {
  const b = tank.all?.battles ?? 0;
  if (b <= 0) return;
  acc.battles += b;
  acc.wins += tank.all.wins;
  acc.frags += tank.all.frags;
  acc.damage += tank.all.damage_dealt;
  acc.spotted += tank.all.spotted;
  acc.droppedCap += tank.all.dropped_capture_points;
  const meta = encyclopedia[String(tank.tank_id)];
  if (meta) {
    acc.tierWeighted += meta.tier * b;
    acc.metaBattles += b;
  }
}

export function wn7Finalize(acc: WN7Acc): number | null {
  if (acc.battles === 0) return null;
  const avgTier = acc.metaBattles > 0 ? acc.tierWeighted / acc.metaBattles : null;
  return computeWN7(
    {
      battles: acc.battles,
      wins: acc.wins,
      frags: acc.frags,
      damageDealt: acc.damage,
      spotted: acc.spotted,
      droppedCapturePoints: acc.droppedCap,
    },
    avgTier,
  );
}

export function computeWN7(s: WN7Inputs, avgTier: number | null): number | null {
  if (avgTier === null || s.battles <= 0) return null;
  const tier = avgTier;
  const winrate = (s.wins / s.battles) * 100;
  const frags = s.frags / s.battles;
  const dmg = s.damageDealt / s.battles;
  const spot = s.spotted / s.battles;
  const def = s.droppedCapturePoints / s.battles;

  return (
    (1240 - 1040 / Math.min(tier, 6) ** 0.164) * frags +
    (dmg * 530) / (184 * Math.exp(0.24 * tier) + 130) +
    (spot * 125 * Math.min(tier, 3)) / 3 +
    Math.min(def, 2.2) * 100 +
    (185 / (0.17 + Math.exp((winrate - 35) * -0.134)) - 500) * 0.45 -
    ((5 - Math.min(tier, 5)) * 125) /
      (1 + Math.exp((tier - s.battles / 220) ** 2 / 1.5))
  );
}

export type WN8Expected = {
  expDamage: number;
  expSpot: number;
  expFrag: number;
  expDef: number;
  expWinRate: number;
};

/**
 * Build a (tier, type) → mean expected-values fallback table from the modxvm
 * dataset, used in `computeWN8` when a tank is missing from the dataset.
 *
 * modxvm's `wn8exp.json` lags behind WG releases: new premiums, Tier 11
 * additions and event tanks routinely have no expected values for months
 * after they ship. The original WN8 paper [1] explicitly prescribes the
 * remedy: "tanks where there is insufficient data ... are given the same
 * values as a similar tank of the same tier and type". This helper materializes
 * that prescription as a Map keyed by `${tier}-${type}` (e.g. `"10-heavyTank"`).
 *
 * [1] https://koreanrandom.com/forum/topic/81531-wn8-a-detailed-article-about-the-rating-and-its-formula-from-its-developers/
 */
export function buildWN8Fallback(
  expected: Map<number, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
): Map<string, WN8Expected> {
  type Sum = {
    expDamage: number;
    expSpot: number;
    expFrag: number;
    expDef: number;
    expWinRate: number;
    count: number;
  };
  const groups = new Map<string, Sum>();
  for (const [tankId, exp] of expected) {
    const meta = encyclopedia[String(tankId)];
    if (!meta) continue;
    const key = `${meta.tier}-${meta.type}`;
    const g = groups.get(key) ?? {
      expDamage: 0,
      expSpot: 0,
      expFrag: 0,
      expDef: 0,
      expWinRate: 0,
      count: 0,
    };
    g.expDamage += exp.expDamage;
    g.expSpot += exp.expSpot;
    g.expFrag += exp.expFrag;
    g.expDef += exp.expDef;
    g.expWinRate += exp.expWinRate;
    g.count += 1;
    groups.set(key, g);
  }
  const fallback = new Map<string, WN8Expected>();
  for (const [key, g] of groups) {
    fallback.set(key, {
      expDamage: g.expDamage / g.count,
      expSpot: g.expSpot / g.count,
      expFrag: g.expFrag / g.count,
      expDef: g.expDef / g.count,
      expWinRate: g.expWinRate / g.count,
    });
  }
  return fallback;
}

/**
 * A battle-weighted WN8 accumulator: the additive sums the rating formula runs
 * on. Split out from `computeWN8` so a caller can add each tank once, then get
 * the aggregate with any subset removed in O(1) (subtract that tank's sums)
 * instead of re-summing the whole roster (see the lift/drag scan). `computeWN8`
 * itself is just accumulate-all + finalize, so the numbers are unchanged.
 */
export type WN8Acc = {
  expDmg: number;
  expSpot: number;
  expFrag: number;
  expDef: number;
  expWin: number;
  dmg: number;
  spot: number;
  frag: number;
  def: number;
  wins: number;
  battles: number;
};

export function wn8AccZero(): WN8Acc {
  return {
    expDmg: 0, expSpot: 0, expFrag: 0, expDef: 0, expWin: 0,
    dmg: 0, spot: 0, frag: 0, def: 0, wins: 0, battles: 0,
  };
}

/** Add one tank's contribution into `acc`. A no-op for a tank with no battles or
 * no expected values (a recent premium/event/Tier 11 without even a (tier,type)
 * fallback), exactly like `computeWN8`'s `continue`s, so such a tank leaves the
 * aggregate untouched, which keeps the O(1) removal exact. */
export function wn8AccAdd(
  acc: WN8Acc,
  tank: TankStats,
  expected: Map<number, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
  fallback: Map<string, WN8Expected>,
): void {
  const tb = tank.all?.battles ?? 0;
  if (tb <= 0) return;
  let exp = expected.get(tank.tank_id);
  if (!exp) {
    const meta = encyclopedia[String(tank.tank_id)];
    if (meta) exp = fallback.get(`${meta.tier}-${meta.type}`);
  }
  if (!exp) return;

  acc.expDmg += exp.expDamage * tb;
  acc.expSpot += exp.expSpot * tb;
  acc.expFrag += exp.expFrag * tb;
  acc.expDef += exp.expDef * tb;
  acc.expWin += exp.expWinRate * tb;

  acc.dmg += tank.all.damage_dealt;
  acc.spot += tank.all.spotted;
  acc.frag += tank.all.frags;
  acc.def += tank.all.dropped_capture_points;
  acc.wins += tank.all.wins;
  acc.battles += tb;
}

export function wn8Finalize(a: WN8Acc): number | null {
  if (a.battles === 0 || a.expDmg === 0) return null;

  const rDamage = a.dmg / a.expDmg;
  const rSpot = a.spot / a.expSpot;
  const rFrag = a.frag / a.expFrag;
  const rDef = a.def / a.expDef;
  const rWin = (a.wins * 100) / a.expWin;

  const rWINc = Math.max(0, (rWin - 0.71) / (1 - 0.71));
  const rDAMAGEc = Math.max(0, (rDamage - 0.22) / (1 - 0.22));
  const rFRAGc = Math.max(
    0,
    Math.min(rDAMAGEc + 0.2, (rFrag - 0.12) / (1 - 0.12)),
  );
  const rSPOTc = Math.max(
    0,
    Math.min(rDAMAGEc + 0.1, (rSpot - 0.38) / (1 - 0.38)),
  );
  const rDEFc = Math.max(
    0,
    Math.min(rDAMAGEc + 0.1, (rDef - 0.1) / (1 - 0.1)),
  );

  const result =
    980 * rDAMAGEc +
    210 * rDAMAGEc * rFRAGc +
    155 * rFRAGc * rSPOTc +
    75 * rDEFc * rFRAGc +
    145 * Math.min(1.8, rWINc);
  return Number.isFinite(result) ? result : null;
}

export function computeWN8(
  tanks: TankStats[],
  expected: Map<number, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
  fallback: Map<string, WN8Expected>,
): number | null {
  const acc = wn8AccZero();
  for (const tank of tanks) {
    wn8AccAdd(acc, tank, expected, encyclopedia, fallback);
  }
  return wn8Finalize(acc);
}

export type WNXExpected = {
  damage: number;
  frags: number;
  spots: number;
  assist: number;
};

/** Battle-weighted WNX accumulator. Same split rationale as {@link WN8Acc}: add
 * each tank once, remove any subset in O(1). */
export type WNXAcc = {
  wExpDmg: number;
  wExpSpot: number;
  wExpFrag: number;
  wExpAssist: number;
  wDmg: number;
  wSpot: number;
  wFrag: number;
  wAssist: number;
};

export function wnxAccZero(): WNXAcc {
  return {
    wExpDmg: 0, wExpSpot: 0, wExpFrag: 0, wExpAssist: 0,
    wDmg: 0, wSpot: 0, wFrag: 0, wAssist: 0,
  };
}

/** Add one tank into `acc`; a no-op for a tank with no battles or no expected
 * values, matching `computeWNX`'s `continue` (so removal stays exact). */
export function wnxAccAdd(
  acc: WNXAcc,
  t: TankStats,
  expected: Map<number, WNXExpected>,
): void {
  const exp = expected.get(t.tank_id);
  const b = t.all?.battles ?? 0;
  if (!exp || b <= 0) return;

  acc.wExpDmg += b * exp.damage;
  acc.wExpSpot += b * exp.spots;
  acc.wExpFrag += b * exp.frags;
  acc.wExpAssist += b * exp.assist;

  acc.wDmg += t.all.damage_dealt;
  acc.wSpot += t.all.spotted;
  acc.wFrag += t.all.frags;
  acc.wAssist +=
    (t.all.radio_assisted_damage ?? 0) +
    (t.all.track_assisted_damage ?? 0);
}

export function wnxFinalize(acc: WNXAcc): number | null {
  const {
    wExpDmg, wExpSpot, wExpFrag, wExpAssist, wDmg, wSpot, wFrag, wAssist,
  } = acc;
  if (wExpDmg <= 0) return null;

  const adjustedAssist = wAssist * 0.67;
  const adjustedExpAssist = wExpAssist * 0.67;
  const combinedDamage = wDmg + adjustedAssist;
  const combinedExpDamage = wExpDmg + adjustedExpAssist;

  const rDmg = combinedDamage / combinedExpDamage;
  const rDmgC = Math.max(
    0,
    Math.min(rDmg - 0.22, (rDmg - 0.22) / (1 - 0.22)),
  );

  const rFrags = wFrag / wExpFrag;
  const rSpots = wSpot / wExpSpot;
  const rFragsC = Math.max(
    0,
    Math.min(rDmgC + 0.4, (rFrags - 0.12) / (1 - 0.12)),
  );
  const rSpotsC = Math.max(
    0,
    Math.min(rDmgC + 0.2, (rSpots - 0.38) / (1 - 0.38)),
  );

  const raw = 750 * rDmgC + 200 * rFragsC + 50 * rSpotsC;
  const result = raw * (raw / 1000) ** 0.45 * 1.65;
  return Number.isFinite(result) ? result : null;
}

export function computeWNX(
  tanks: TankStats[],
  expected: Map<number, WNXExpected>,
): number | null {
  const acc = wnxAccZero();
  for (const t of tanks) wnxAccAdd(acc, t, expected);
  return wnxFinalize(acc);
}

// HR, the Steel Hunter (battle-royale) performance rating. It is built on just
// two axes: the game's average XP per battle (the single effectiveness signal,
// since the XP formula already integrates damage, frags, spotting, survival time
// and placement) and the win rate (the outcome, i.e. how consistently you reach
// the top), each normalised to the EU population median at >= HR_MIN_BATTLES SH
// battles, equally weighted, times a volume-confidence discount so a tiny sample
// cannot top the board. Using XP instead of separate damage/frags/survival axes
// removes the double-counting those baked into the XP anyway. A median SH player
// lands ~942 (= Average on `hrColor`), the same way WN8/WNX anchor average at
// Average. Steel Hunter stats come from WG's (repurposed) `statistics.fallout`
// block; see `falloutStatsFromSnapshot`.
export type HRInputs = {
  battles: number;
  wins: number;
  avgXp: number;
};

// Leaderboard gate: only rank players with at least this many SH battles. The
// value is stored on the players row regardless; the top query applies the gate.
export const HR_MIN_BATTLES = 100;

const HR_SCALE = 1500;
const HR_VOLUME_K = 100; // half volume-credit at 100 SH battles
// Axis baselines = EU population medians at >= 100 SH battles. Exported because
// the leaderboard computes HRB in SQL over the cached sh_* totals (see
// `hrbSql`), so both sides read the same numbers rather than each keeping a
// copy of the formula.
export const HR_WR_BASE = 0.41;
export const HR_XP_BASE = 1034;
// Axis weights: effectiveness (XP) and outcome (win rate) count equally.
export const HR_W_XP = 0.5;
export const HR_W_WIN = 0.5;

// The effectiveness score both Hunter ratings are built on: average XP and win
// rate, each read against the population median and weighted equally. HR and
// HRB differ only in what they then do with the battle count.
function hunterScore(s: HRInputs): number {
  const rXp = s.avgXp / HR_XP_BASE;
  const rWin = s.wins / s.battles / HR_WR_BASE;
  return HR_W_XP * rXp + HR_W_WIN * rWin;
}

/** Steel Hunter HR rating. Null when the player has no Steel Hunter battles. */
export function computeHR(s: HRInputs): number | null {
  const b = s.battles;
  if (!b || b <= 0) return null;
  const vol = b / (b + HR_VOLUME_K);
  const hr = HR_SCALE * hunterScore(s) * vol;
  return Number.isFinite(hr) ? Math.round(hr) : null;
}

// Thresholds calibrated on the EU HR value distribution at >= 100 SH battles
// (n~3.3k; p50 ~942, p85 ~1301, p95 ~1503, p98 ~1620, p99 ~1721, max ~2096).
// The XP-based scale is tighter than the old damage-based one, so buckets are set
// by population percentile to match the community rarity of each tier: the top
// (super unicum) is ~top 1%, Excellent ~1%, Super ~3%. Same 9 RatingColor
// buckets as the other scales.
export function hrColor(value: number): RatingColor {
  if (value < 550) return RatingColor.VeryBad;
  if (value < 680) return RatingColor.Bad;
  if (value < 820) return RatingColor.BelowAvg;
  if (value < 1070) return RatingColor.Average;
  if (value < 1300) return RatingColor.Good;
  if (value < 1500) return RatingColor.VeryGood;
  if (value < 1620) return RatingColor.Super;
  if (value < 1720) return RatingColor.Excellent;
  return RatingColor.Top;
}

// HRB, the "battles-based" Hunter Rating. Same effectiveness score as HR (XP +
// win rate), but battle volume REWARDS instead of discounting: winning is very
// hard in battle royale, so winning AND playing a lot is the real feat. The
// volume brake `battles/(battles+K)` is replaced by a growing `ln(1+battles/50)`
// term, and the whole thing rescaled (×635) so the median lands ~943 like HR,
// keeping the two columns comparable: HRB = 635 · (0.5·XP/1034 + 0.5·WR/0.41) ·
// ln(1+battles/50). The leaderboard evaluates that same expression in SQL over
// the cached sh_* totals (see `hrbSql`) rather than calling this, since it ranks
// the whole population, so the two share the constants below.
export const HRB_SCALE = 635;
export const HRB_VOLUME_K = 50; // the volume term reaches 1 around 85 battles

/** Steel Hunter HRB rating. Null when the player has no Steel Hunter battles. */
export function computeHRB(s: HRInputs): number | null {
  const b = s.battles;
  if (!b || b <= 0) return null;
  const vol = Math.log(1 + b / HRB_VOLUME_K);
  const hrb = HRB_SCALE * hunterScore(s) * vol;
  return Number.isFinite(hrb) ? Math.round(hrb) : null;
}

// Thresholds calibrated on the EU HRB distribution at >= 100 SH battles (n~3.3k;
// p50 ~943, p85 ~1516, p95 ~1995, p99 ~2504, max ~3538) by population percentile,
// matching each tier's community rarity (top ~1%). Wider than HR, hence its own
// scale rather than reusing hrColor.
export function hrbColor(value: number): RatingColor {
  if (value < 520) return RatingColor.VeryBad;
  if (value < 645) return RatingColor.Bad;
  if (value < 795) return RatingColor.BelowAvg;
  if (value < 1120) return RatingColor.Average;
  if (value < 1520) return RatingColor.Good;
  if (value < 2000) return RatingColor.VeryGood;
  if (value < 2350) return RatingColor.Super;
  if (value < 2500) return RatingColor.Excellent;
  return RatingColor.Top;
}

// Steel Hunter win rate is a top-5 finish in battle royale, so its baseline
// (HR_WR_BASE ≈ 0.41) sits well below a random-battle 50%. Anchoring the tiers
// to that baseline (rather than reusing the random `winrateColor`) keeps the
// median SH player at Average instead of painting the whole board "very bad".
export function steelHunterWinrateColor(wr: number): RatingColor {
  const b = HR_WR_BASE;
  if (wr < b - 0.06) return RatingColor.VeryBad;
  if (wr < b - 0.04) return RatingColor.Bad;
  if (wr < b - 0.02) return RatingColor.BelowAvg;
  if (wr < b + 0.02) return RatingColor.Average;
  if (wr < b + 0.05) return RatingColor.Good;
  if (wr < b + 0.08) return RatingColor.VeryGood;
  if (wr < b + 0.12) return RatingColor.Super;
  if (wr < b + 0.17) return RatingColor.Excellent;
  return RatingColor.Top;
}

// Stronghold Rating (SR) and its battles-based sibling (SRB) each use ONE
// absolute scale across all tiers, like WNX: a given value always means the same
// clan quality (SR is roster strength x win-rate, tier-independent by
// construction; SRB is that same SR bumped by battle volume), so a purple clan
// genuinely dominates the mode whatever the tier, and the count in each tier
// reflects reality rather than a fixed percentile quota. SR is anchored to win
// rate: Top (>=5000) ~ a 60%+ WR roster that wins clearly, Average (~1500) ~ a
// break-even clan. SRB sits higher (it is >= SR) and rewards proven volume, so
// the continuously-played tiers (T10) legitimately field more high-SRB clans.
const RATING_COLOR_ORDER: readonly RatingColor[] = [
  RatingColor.VeryBad,
  RatingColor.Bad,
  RatingColor.BelowAvg,
  RatingColor.Average,
  RatingColor.Good,
  RatingColor.VeryGood,
  RatingColor.Super,
  RatingColor.Excellent,
];

function tierColor(value: number, thresholds: readonly number[]): RatingColor {
  for (let i = 0; i < thresholds.length; i++) {
    if (value < thresholds[i]) return RATING_COLOR_ORDER[i];
  }
  return RatingColor.Top;
}

// One absolute scale each, every tier. The 8 ascending bucket boundaries. SRB
// sits ~2.5x higher than SR because it multiplies SR by the (>=1) volume bonus.
const SR_THRESHOLDS: readonly number[] = [
  250, 600, 1200, 2000, 2500, 3000, 4000, 5000,
];

const SRB_THRESHOLDS: readonly number[] = [
  500, 1200, 2400, 4000, 5500, 7500, 10000, 13000,
];

/** Color for a clan's Stronghold Rating (one absolute scale, all tiers). */
export function strongholdRatingColor(sr: number): RatingColor {
  return tierColor(sr, SR_THRESHOLDS);
}

/** Color for a clan's battles-based Stronghold Rating (one absolute scale). */
export function strongholdRatingBattlesColor(srb: number): RatingColor {
  return tierColor(srb, SRB_THRESHOLDS);
}

// Human-readable ranges for the stronghold Rating scale legend, derived from the
// threshold tables so the legend can never drift from the color functions. Both
// SR and SRB are one absolute scale for every tier.
export function strongholdScaleRanges(): {
  color: RatingColor;
  sr: string;
  srb: string;
}[] {
  const fmt = (thr: readonly number[]): string[] => {
    const out: string[] = [];
    for (let i = 0; i <= thr.length; i++) {
      if (i === 0) out.push(`<${thr[0]}`);
      else if (i === thr.length) out.push(`≥${thr[thr.length - 1]}`);
      else out.push(`${thr[i - 1]}-${thr[i] - 1}`);
    }
    return out;
  };
  const sr = fmt(SR_THRESHOLDS);
  const srb = fmt(SRB_THRESHOLDS);
  // Highest tier first (Top), to read top-down like the other scales.
  return RATING_COLOR_ORDER.concat(RatingColor.Top)
    .map((color, i) => ({ color, sr: sr[i], srb: srb[i] }))
    .reverse();
}
