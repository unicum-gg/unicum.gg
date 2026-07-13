import type {
  ClanGlobalMapStats,
  ClanStrongholdStats,
} from "@unicum.gg/core/clans/snapshot-stats";
import { renderTable, type TableRow } from "./table.js";

// Text mirror of the clan page's Stronghold and Clan Wars tables
// (components/clans/{stronghold-stats,clan-wars-stats}): same rows, same order,
// same formatters. Rendered as aligned code blocks, and only when the clan
// actually has data in that category.
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DASH = "—";
const int = (v: number | null): string => (v == null ? DASH : intFmt.format(v));
const wr = (wins: number | null, battles: number | null): string =>
  wins == null || battles == null || battles === 0
    ? DASH
    : pctFmt.format(wins / battles);

const hasData = (stats: Record<string, number | null>): boolean =>
  Object.values(stats).some((v) => v !== null);

function strongholdRows(s: ClanStrongholdStats): TableRow[] {
  return [
    { label: "ELO T10", primary: int(s.eloT10) },
    { label: "Advances T10", primary: int(s.advancesBattlesT10) },
    {
      label: "Advances T10 WR",
      primary: wr(s.advancesWinsT10, s.advancesBattlesT10),
    },
    { label: "Skirmish T10", primary: int(s.skirmishBattlesT10) },
    {
      label: "Skirmish T10 WR",
      primary: wr(s.skirmishWinsT10, s.skirmishBattlesT10),
    },
    { label: "ELO T8", primary: int(s.eloT8) },
    { label: "Skirmish T8", primary: int(s.skirmishBattlesT8) },
    {
      label: "Skirmish T8 WR",
      primary: wr(s.skirmishWinsT8, s.skirmishBattlesT8),
    },
    { label: "ELO T6", primary: int(s.eloT6) },
    { label: "Skirmish T6", primary: int(s.skirmishBattlesT6) },
    {
      label: "Skirmish T6 WR",
      primary: wr(s.skirmishWinsT6, s.skirmishBattlesT6),
    },
  ];
}

function clanWarsRows(s: ClanGlobalMapStats): TableRow[] {
  return [
    { label: "Provinces", primary: int(s.gmProvinces) },
    { label: "ELO T10", primary: int(s.gmEloT10) },
    { label: "Battles T10", primary: int(s.gmBattlesT10) },
    { label: "Win rate T10", primary: wr(s.gmWinsT10, s.gmBattlesT10) },
    { label: "ELO T8", primary: int(s.gmEloT8) },
    { label: "Battles T8", primary: int(s.gmBattlesT8) },
    { label: "Win rate T8", primary: wr(s.gmWinsT8, s.gmBattlesT8) },
    { label: "ELO T6", primary: int(s.gmEloT6) },
    { label: "Battles T6", primary: int(s.gmBattlesT6) },
    { label: "Win rate T6", primary: wr(s.gmWinsT6, s.gmBattlesT6) },
  ];
}

/** Stronghold table, or null when the clan has no stronghold data. */
export function buildStrongholdBlock(s: ClanStrongholdStats): string | null {
  return hasData(s) ? renderTable(strongholdRows(s)) : null;
}

/** Clan Wars (global map) table, or null when the clan has no CW data. */
export function buildClanWarsBlock(s: ClanGlobalMapStats): string | null {
  return hasData(s) ? renderTable(clanWarsRows(s)) : null;
}
