import type { VehicleMeta } from "./vehicle-meta";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";

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

export function computeWN8(
  tanks: TankStats[],
  expected: Map<number, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
  fallback: Map<string, WN8Expected>,
): number | null {
  let expDmg = 0;
  let expSpot = 0;
  let expFrag = 0;
  let expDef = 0;
  let expWin = 0;
  let dmg = 0;
  let spot = 0;
  let frag = 0;
  let def = 0;
  let wins = 0;
  let battles = 0;

  for (const tank of tanks) {
    const tb = tank.all?.battles ?? 0;
    if (tb <= 0) continue;
    let exp = expected.get(tank.tank_id);
    if (!exp) {
      // Tank missing from modxvm dataset (typically a recent premium, event
      // tank or a Tier 11) — fall back to the mean of same (tier, type) per
      // the WN8 paper's prescription.
      const meta = encyclopedia[String(tank.tank_id)];
      if (meta) exp = fallback.get(`${meta.tier}-${meta.type}`);
    }
    if (!exp) continue;

    expDmg += exp.expDamage * tb;
    expSpot += exp.expSpot * tb;
    expFrag += exp.expFrag * tb;
    expDef += exp.expDef * tb;
    expWin += exp.expWinRate * tb;

    dmg += tank.all.damage_dealt;
    spot += tank.all.spotted;
    frag += tank.all.frags;
    def += tank.all.dropped_capture_points;
    wins += tank.all.wins;
    battles += tb;
  }

  if (battles === 0 || expDmg === 0) return null;

  const rDamage = dmg / expDmg;
  const rSpot = spot / expSpot;
  const rFrag = frag / expFrag;
  const rDef = def / expDef;
  const rWin = (wins * 100) / expWin;

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

export type WNXExpected = {
  damage: number;
  frags: number;
  spots: number;
  assist: number;
};

export function computeWNX(
  tanks: TankStats[],
  expected: Map<number, WNXExpected>,
): number | null {
  let wExpDmg = 0;
  let wExpSpot = 0;
  let wExpFrag = 0;
  let wExpAssist = 0;
  let wDmg = 0;
  let wSpot = 0;
  let wFrag = 0;
  let wAssist = 0;

  for (const t of tanks) {
    const exp = expected.get(t.tank_id);
    const b = t.all?.battles ?? 0;
    if (!exp || b <= 0) continue;

    wExpDmg += b * exp.damage;
    wExpSpot += b * exp.spots;
    wExpFrag += b * exp.frags;
    wExpAssist += b * exp.assist;

    wDmg += t.all.damage_dealt;
    wSpot += t.all.spotted;
    wFrag += t.all.frags;
    wAssist +=
      (t.all.radio_assisted_damage ?? 0) +
      (t.all.track_assisted_damage ?? 0);
  }

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
