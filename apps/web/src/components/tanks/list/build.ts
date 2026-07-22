// Framework-free builders shared by the server page (initial active tab) and the
// client index (lazy-loaded tabs), so both turn the same bulk-endpoint responses
// into the same row shape. No "use client" / no SDK here — callers do the
// fetching (buildSafe on the server, SWR on the client) and pass the results in.
import type { TankSpecRow } from "@/components/tanks/list/spec-columns";
import { TankTab } from "@/components/tanks/list/tabs";

export type TankStatsRow = {
  players: number; // number of players in the sample (the "Count" column)
  battles: number | null; // total games played on the tank
  wr: number; // win rate, 0-100
  playerWr: number | null; // avg driver account WR, 0-100
  dpg: number; // avg damage
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  kdr: number | null;
  assists: number | null; // avg assisted damage
  hitPct: number | null; // 0-100
  penPct: number | null; // 0-100
  spots: number | null; // avg spots
  blocked: number | null; // avg blocked damage
  survival: number | null; // 0-100
};

// XP thresholds for the four Mark of Mastery badges (3rd/2nd/1st/Ace).
export type MasteryRow = {
  class3: number;
  class2: number;
  class1: number;
  ace: number;
};

// Combined-damage thresholds for the three Marks of Excellence (65/85/95%).
export type MoeRow = {
  mark1: number;
  mark2: number;
  mark3: number;
};

export type TankListItem = {
  tankId: number;
  slug: string;
  name: string;
  shortName: string;
  tag: string;
  tier: number;
  nation: string;
  type: string;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  stats: TankStatsRow | null;
  specs: TankSpecRow | null;
  mastery: MasteryRow | null;
  moe: MoeRow | null;
};

// The four data groups behind the five tabs. Each tab needs exactly one group;
// Specifications and Economics are two views of the same spec+econ group, so a
// visit to either warms both.
export enum TankGroup {
  Stats = "stats",
  Specs = "specs",
  Moe = "moe",
  Mastery = "mastery",
}

export function groupForTab(tab: TankTab): TankGroup {
  switch (tab) {
    case TankTab.Performances:
      return TankGroup.Stats;
    case TankTab.Specifications:
    case TankTab.Economics:
      return TankGroup.Specs;
    case TankTab.MarksOfExcellence:
      return TankGroup.Moe;
    case TankTab.MarksOfMastery:
      return TankGroup.Mastery;
  }
}

// The `identity` block every bulk endpoint returns per tank.
type RawIdentity = {
  tankId: number;
  slug: string;
  name: string;
  shortName: string;
  tag: string;
  tier: number;
  nation: string;
  type: string;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
};

function base(i: RawIdentity): TankListItem {
  return {
    tankId: i.tankId,
    slug: i.slug,
    name: i.name,
    shortName: i.shortName,
    tag: i.tag,
    tier: i.tier,
    nation: i.nation,
    type: i.type,
    role: i.role,
    isPremium: i.isPremium,
    isReward: i.isReward,
    stats: null,
    specs: null,
    mastery: null,
    moe: null,
  };
}

type RawStats = {
  players: number;
  total_battles: number | null;
  winrate: number;
  player_wr: number | null;
  avg_damage: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  kdr: number | null;
  avg_assist: number | null;
  hit_pct: number | null;
  pen_pct: number | null;
  avg_spots: number | null;
  avg_blocked: number | null;
  survival: number | null;
};

function statsRow(s: RawStats | null): TankStatsRow | null {
  if (!s) return null;
  return {
    players: s.players,
    battles: s.total_battles,
    wr: s.winrate,
    playerWr: s.player_wr,
    dpg: s.avg_damage,
    wn7: s.wn7,
    wn8: s.wn8,
    wnx: s.wnx,
    kdr: s.kdr,
    assists: s.avg_assist,
    hitPct: s.hit_pct,
    penPct: s.pen_pct,
    spots: s.avg_spots,
    blocked: s.avg_blocked,
    survival: s.survival,
  };
}

// The row set comes from the performances endpoint (tanks with battle data), so
// this is the canonical Performances tab list.
export function buildStatsItems(
  perf: { identity: RawIdentity; stats: RawStats | null }[],
): TankListItem[] {
  return perf.map(({ identity, stats }) => ({
    ...base(identity),
    stats: statsRow(stats),
  }));
}

// Specifications + Economics share the same rows: the spec columns span both the
// specifications and economics projections of the same spec row, merged by slug.
export function buildSpecItems(
  specifications: { identity: RawIdentity; specifications: object }[],
  economics: { identity: { slug: string }; economics: object }[],
): TankListItem[] {
  const econBySlug = new Map(
    economics.map((r) => [r.identity.slug, r.economics]),
  );
  return specifications.map(({ identity, specifications: spec }) => ({
    ...base(identity),
    specs: { ...spec, ...(econBySlug.get(identity.slug) ?? {}) } as TankSpecRow,
  }));
}

export function buildMoeItems(
  moe: { identity: RawIdentity; moe: MoeRow | null }[],
): TankListItem[] {
  return moe.map((r) => ({ ...base(r.identity), moe: r.moe }));
}

export function buildMasteryItems(
  mastery: { identity: RawIdentity; mastery: MasteryRow | null }[],
): TankListItem[] {
  return mastery.map((r) => ({ ...base(r.identity), mastery: r.mastery }));
}
