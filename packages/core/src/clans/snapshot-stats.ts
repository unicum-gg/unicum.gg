import type { ClanSnapshot } from "@unicum.gg/core/db/schema";

// Pure, db-free projections and diffs over a clan snapshot row. Kept apart from
// `snapshots.ts` (which imports `db`) so client components can pull these
// helpers into the browser bundle without dragging the Postgres driver (and its
// `fs`/`net`/`tls` node built-ins) along with them.

export type ClanStrongholdStats = {
  eloT6: number | null;
  skirmishBattlesT6: number | null;
  skirmishWinsT6: number | null;
  eloT8: number | null;
  skirmishBattlesT8: number | null;
  skirmishWinsT8: number | null;
  eloT10: number | null;
  skirmishBattlesT10: number | null;
  skirmishWinsT10: number | null;
  advancesBattlesT10: number | null;
  advancesWinsT10: number | null;
};

export type ClanGlobalMapStats = {
  gmEloT10: number | null;
  gmBattlesT10: number | null;
  gmWinsT10: number | null;
  gmEloT8: number | null;
  gmBattlesT8: number | null;
  gmWinsT8: number | null;
  gmEloT6: number | null;
  gmBattlesT6: number | null;
  gmWinsT6: number | null;
  gmProvinces: number | null;
};

export type ClanSnapshotPeriods = {
  h24: ClanSnapshot | null;
  d7: ClanSnapshot | null;
  d30: ClanSnapshot | null;
};

export function strongholdStatsFromClanSnapshot(
  s: ClanSnapshot,
): ClanStrongholdStats {
  return {
    eloT6: s.eloT6,
    skirmishBattlesT6: s.skirmishBattlesT6,
    skirmishWinsT6: s.skirmishWinsT6,
    eloT8: s.eloT8,
    skirmishBattlesT8: s.skirmishBattlesT8,
    skirmishWinsT8: s.skirmishWinsT8,
    eloT10: s.eloT10,
    skirmishBattlesT10: s.skirmishBattlesT10,
    skirmishWinsT10: s.skirmishWinsT10,
    advancesBattlesT10: s.advancesBattlesT10,
    advancesWinsT10: s.advancesWinsT10,
  };
}

export function globalMapStatsFromClanSnapshot(
  s: ClanSnapshot,
): ClanGlobalMapStats {
  return {
    gmEloT10: s.gmEloT10,
    gmBattlesT10: s.gmBattlesT10,
    gmWinsT10: s.gmWinsT10,
    gmEloT8: s.gmEloT8,
    gmBattlesT8: s.gmBattlesT8,
    gmWinsT8: s.gmWinsT8,
    gmEloT6: s.gmEloT6,
    gmBattlesT6: s.gmBattlesT6,
    gmWinsT6: s.gmWinsT6,
    gmProvinces: s.gmProvinces,
  };
}

export function diffClanGlobalMapStats(
  curr: ClanGlobalMapStats,
  prev: ClanGlobalMapStats,
): ClanGlobalMapStats {
  function diff(a: number | null, b: number | null): number | null {
    return a !== null && b !== null ? a - b : null;
  }
  return {
    gmEloT10: diff(curr.gmEloT10, prev.gmEloT10),
    gmBattlesT10: diff(curr.gmBattlesT10, prev.gmBattlesT10),
    gmWinsT10: diff(curr.gmWinsT10, prev.gmWinsT10),
    gmEloT8: diff(curr.gmEloT8, prev.gmEloT8),
    gmBattlesT8: diff(curr.gmBattlesT8, prev.gmBattlesT8),
    gmWinsT8: diff(curr.gmWinsT8, prev.gmWinsT8),
    gmEloT6: diff(curr.gmEloT6, prev.gmEloT6),
    gmBattlesT6: diff(curr.gmBattlesT6, prev.gmBattlesT6),
    gmWinsT6: diff(curr.gmWinsT6, prev.gmWinsT6),
    gmProvinces: diff(curr.gmProvinces, prev.gmProvinces),
  };
}

export function diffClanStrongholdStats(
  curr: ClanStrongholdStats,
  prev: ClanStrongholdStats,
): ClanStrongholdStats {
  function diff(a: number | null, b: number | null): number | null {
    return a !== null && b !== null ? a - b : null;
  }
  return {
    eloT6: diff(curr.eloT6, prev.eloT6),
    skirmishBattlesT6: diff(curr.skirmishBattlesT6, prev.skirmishBattlesT6),
    skirmishWinsT6: diff(curr.skirmishWinsT6, prev.skirmishWinsT6),
    eloT8: diff(curr.eloT8, prev.eloT8),
    skirmishBattlesT8: diff(curr.skirmishBattlesT8, prev.skirmishBattlesT8),
    skirmishWinsT8: diff(curr.skirmishWinsT8, prev.skirmishWinsT8),
    eloT10: diff(curr.eloT10, prev.eloT10),
    skirmishBattlesT10: diff(curr.skirmishBattlesT10, prev.skirmishBattlesT10),
    skirmishWinsT10: diff(curr.skirmishWinsT10, prev.skirmishWinsT10),
    advancesBattlesT10: diff(curr.advancesBattlesT10, prev.advancesBattlesT10),
    advancesWinsT10: diff(curr.advancesWinsT10, prev.advancesWinsT10),
  };
}
