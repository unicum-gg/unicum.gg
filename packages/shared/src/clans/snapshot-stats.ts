import { StrongholdPeriod } from "../constants/stronghold";
import type { ClanSnapshot } from "../db/schema";

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

/**
 * The snapshot a period column diffs against, plus whether that diff can honestly
 * carry the column's label.
 *
 * `attributable` is false when the baseline predates the period's cutoff by more
 * than the period itself, so the measured span is over twice the label and any
 * activity in the overhang would be counted into the wrong column. A ZERO delta
 * is still exact in that case and is reported as such, battles and wins only
 * ever go up, so a total that did not move across the wider span cannot have
 * moved inside it either.
 */
export type ClanPeriodBaseline = {
  snapshot: ClanSnapshot;
  attributable: boolean;
};

export type ClanSnapshotPeriods = {
  h24: ClanPeriodBaseline | null;
  d7: ClanPeriodBaseline | null;
  d30: ClanPeriodBaseline | null;
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
  attributable = true,
): ClanGlobalMapStats {
  const diff = makeDiff(attributable);
  const rating = makeRatingDiff(attributable);
  const b10 = diff(curr.gmBattlesT10, prev.gmBattlesT10);
  const b8 = diff(curr.gmBattlesT8, prev.gmBattlesT8);
  const b6 = diff(curr.gmBattlesT6, prev.gmBattlesT6);
  return {
    gmEloT10: rating(curr.gmEloT10, prev.gmEloT10, b10),
    gmBattlesT10: b10,
    gmWinsT10: diff(curr.gmWinsT10, prev.gmWinsT10),
    gmEloT8: rating(curr.gmEloT8, prev.gmEloT8, b8),
    gmBattlesT8: b8,
    gmWinsT8: diff(curr.gmWinsT8, prev.gmWinsT8),
    gmEloT6: rating(curr.gmEloT6, prev.gmEloT6, b6),
    gmBattlesT6: b6,
    gmWinsT6: diff(curr.gmWinsT6, prev.gmWinsT6),
    gmProvinces: diff(curr.gmProvinces, prev.gmProvinces),
  };
}

/**
 * Field-wise delta on a MONOTONIC counter (battles, wins, provinces), dropping
 * the ones the period cannot account for.
 *
 * When the baseline sits too far before the cutoff (`attributable` false), a
 * non-zero delta belongs to some wider, unknown span, so it is reported as null
 * and the table shows a dash rather than a number under a label it does not
 * match. Zero survives regardless, and that is exact rather than approximate:
 * a counter that only goes up and did not move across the wider span cannot have
 * moved inside it, so an idle clan keeps reading "0" instead of going blank.
 */
function makeDiff(attributable: boolean) {
  return (a: number | null, b: number | null): number | null => {
    if (a === null || b === null) return null;
    const delta = a - b;
    return delta === 0 || attributable ? delta : null;
  };
}

/**
 * Delta on a RATING (Elo), which moves in both directions and therefore gets no
 * free pass on zero: a rating that climbed and fell back over a span we cannot
 * attribute reads as "+0", asserting stillness we have not measured.
 *
 * The one case where zero is still provable is when the tier played nothing over
 * the span: no battles, no rating movement. So the gate is the tier's own battle
 * delta, not the rating's. `battlesMoved` is null when even that is unknown.
 */
function makeRatingDiff(attributable: boolean) {
  return (
    a: number | null,
    b: number | null,
    battlesMoved: number | null,
  ): number | null => {
    if (a === null || b === null) return null;
    if (attributable || battlesMoved === 0) return a - b;
    return null;
  };
}

export function diffClanStrongholdStats(
  curr: ClanStrongholdStats,
  prev: ClanStrongholdStats,
  attributable = true,
): ClanStrongholdStats {
  const diff = makeDiff(attributable);
  const rating = makeRatingDiff(attributable);
  const battlesT6 = diff(curr.skirmishBattlesT6, prev.skirmishBattlesT6);
  const battlesT8 = diff(curr.skirmishBattlesT8, prev.skirmishBattlesT8);
  const skirmishT10 = diff(curr.skirmishBattlesT10, prev.skirmishBattlesT10);
  const advancesT10 = diff(curr.advancesBattlesT10, prev.advancesBattlesT10);
  // WG gives Advances and Skirmish T10 the same Elo, so tier 10's rating can be
  // moved by either mode: it only stands still when BOTH did.
  const battlesT10 =
    skirmishT10 === null || advancesT10 === null
      ? null
      : skirmishT10 + advancesT10;
  return {
    eloT6: rating(curr.eloT6, prev.eloT6, battlesT6),
    skirmishBattlesT6: battlesT6,
    skirmishWinsT6: diff(curr.skirmishWinsT6, prev.skirmishWinsT6),
    eloT8: rating(curr.eloT8, prev.eloT8, battlesT8),
    skirmishBattlesT8: battlesT8,
    skirmishWinsT8: diff(curr.skirmishWinsT8, prev.skirmishWinsT8),
    eloT10: rating(curr.eloT10, prev.eloT10, battlesT10),
    skirmishBattlesT10: skirmishT10,
    skirmishWinsT10: diff(curr.skirmishWinsT10, prev.skirmishWinsT10),
    advancesBattlesT10: advancesT10,
    advancesWinsT10: diff(curr.advancesWinsT10, prev.advancesWinsT10),
  };
}

// A table-ready view: the latest snapshot projected to stats ("Total" column),
// plus the diff vs each period snapshot (the 24h/7d/30d columns). Built here so
// the `/stronghold` + `/clan-wars` endpoints and the clan page's SSR seed
// produce the exact same shape, and the tables render it with no client-side
// projection or diffing.
// The clan's current (overall) Skirmish Rating per mode/tier, from the
// materialized ratings table (the same SR the boards rank by). Null per tier for
// a clan below the ranking threshold. Unlike the snapshot stats it isn't a
// per-period diff, so it only fills the "Total" column of the stronghold table.
export type ClanStrongholdSr = {
  advances: number | null;
  t10: number | null;
  t8: number | null;
  t6: number | null;
};

/** SR per tier for every window the boards rank on. Keyed by period so adding a
 * window is a value on `StrongholdPeriod`, not another field to thread through
 * the view, the response schema and the table. */
export type ClanStrongholdSrByPeriod = Record<
  StrongholdPeriod,
  ClanStrongholdSr | null
>;

export const EMPTY_STRONGHOLD_SR: ClanStrongholdSrByPeriod = {
  [StrongholdPeriod.Day]: null,
  [StrongholdPeriod.Week]: null,
  [StrongholdPeriod.Month]: null,
  [StrongholdPeriod.Overall]: null,
};

export type ClanStrongholdView = {
  latest: ClanStrongholdStats | null;
  periods: {
    h24: ClanStrongholdStats | null;
    d7: ClanStrongholdStats | null;
    d30: ClanStrongholdStats | null;
  };
  sr: ClanStrongholdSrByPeriod;
};

export function clanStrongholdView(
  latest: ClanSnapshot | null,
  periods: ClanSnapshotPeriods,
  sr: ClanStrongholdSrByPeriod = EMPTY_STRONGHOLD_SR,
): ClanStrongholdView {
  const current = latest ? strongholdStatsFromClanSnapshot(latest) : null;
  // A snapshot row holds Stronghold AND Global Map, and either half may be
  // written alone: a Global-Map-only row leaves every Stronghold column null.
  // Reading that as "we have data" turns the clan page's honest "no stronghold
  // data yet" message into a full table of dashes, so an empty projection counts
  // as no projection.
  if (!current || Object.values(current).every((v) => v === null)) {
    return { latest: null, periods: { h24: null, d7: null, d30: null }, sr };
  }
  const diff = (b: ClanPeriodBaseline | null) =>
    b
      ? diffClanStrongholdStats(
          current,
          strongholdStatsFromClanSnapshot(b.snapshot),
          b.attributable,
        )
      : null;
  return {
    latest: current,
    periods: {
      h24: diff(periods.h24),
      d7: diff(periods.d7),
      d30: diff(periods.d30),
    },
    sr,
  };
}

export type ClanGlobalMapView = {
  latest: ClanGlobalMapStats | null;
  periods: {
    h24: ClanGlobalMapStats | null;
    d7: ClanGlobalMapStats | null;
    d30: ClanGlobalMapStats | null;
  };
};

export function clanGlobalMapView(
  latest: ClanSnapshot | null,
  periods: ClanSnapshotPeriods,
): ClanGlobalMapView {
  if (!latest) {
    return { latest: null, periods: { h24: null, d7: null, d30: null } };
  }
  const current = globalMapStatsFromClanSnapshot(latest);
  const diff = (b: ClanPeriodBaseline | null) =>
    b
      ? diffClanGlobalMapStats(
          current,
          globalMapStatsFromClanSnapshot(b.snapshot),
          b.attributable,
        )
      : null;
  return {
    latest: current,
    periods: {
      h24: diff(periods.h24),
      d7: diff(periods.d7),
      d30: diff(periods.d30),
    },
  };
}
