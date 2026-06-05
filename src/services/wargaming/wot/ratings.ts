import type { TankStats } from "./tanks";

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

type WN8ExpectedRaw = {
  IDNum: number;
  expDamage: number;
  expSpot: number;
  expFrag: number;
  expDef: number;
  expWinRate: number;
};

export async function getWN8ExpectedValues(): Promise<Map<number, WN8Expected>> {
  const res = await fetch(
    "https://static.modxvm.com/wn8-data-exp/json/wn8exp.json",
    { next: { revalidate: 7 * 24 * 60 * 60 } },
  );
  if (!res.ok) {
    throw new Error(`WN8 expected values HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: WN8ExpectedRaw[] };
  const map = new Map<number, WN8Expected>();
  for (const entry of json.data) {
    map.set(entry.IDNum, {
      expDamage: entry.expDamage,
      expSpot: entry.expSpot,
      expFrag: entry.expFrag,
      expDef: entry.expDef,
      expWinRate: entry.expWinRate,
    });
  }
  return map;
}

export function computeWN8(
  tanks: TankStats[],
  expected: Map<number, WN8Expected>,
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
    const exp = expected.get(tank.tank_id);
    const tb = tank.all?.battles ?? 0;
    if (!exp || tb <= 0) continue;

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

type WNXExpectedRaw = {
  tank_id: number;
  expected_damage: number;
  expected_frags: number;
  expected_spots: number;
  expected_assistance: number;
};

export async function getWNXExpectedValues(): Promise<Map<number, WNXExpected>> {
  const res = await fetch(
    "https://api.tomato.gg/api/wnx/wnx-expected-values.json",
    { next: { revalidate: 7 * 24 * 60 * 60 } },
  );
  if (!res.ok) {
    throw new Error(`WNX expected values HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: WNXExpectedRaw[] };
  const map = new Map<number, WNXExpected>();
  for (const e of json.data) {
    map.set(e.tank_id, {
      damage: e.expected_damage,
      frags: e.expected_frags,
      spots: e.expected_spots,
      assist: e.expected_assistance,
    });
  }
  return map;
}

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
