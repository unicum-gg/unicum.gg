import type { Stats } from "@unicum.gg/core/players";
import type { PlayerDerivedStats } from "@unicum.gg/core/players/derived-stats";
import { renderTable, type TableRow } from "./table.js";

// Text mirror of the player page's stats table (components/players/stats-table
// `ROW_DEFS`): same rows, same order, same formatters, but the "Total" column
// only. Rendered as an aligned monospace block so each table row is one line in
// the embed.
const integerFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DASH = "—";
const pctOrDash = (n: number, d: number): string =>
  d <= 0 ? DASH : percentFmt.format(n / d);
const avgOrDash = (n: number, d: number): string =>
  d <= 0 ? DASH : decimalFmt.format(n / d);
const derived = (v: number | null): string =>
  v == null ? DASH : decimalFmt.format(v);

function statRows(s: Stats, d: PlayerDerivedStats): TableRow[] {
  return [
    { label: "Battles", primary: integerFmt.format(s.battles) },
    { label: "Tier", primary: derived(d.tier.total) },
    {
      label: "Wins",
      primary: integerFmt.format(s.wins),
      secondary: pctOrDash(s.wins, s.battles),
    },
    {
      label: "Losses",
      primary: integerFmt.format(s.losses),
      secondary: pctOrDash(s.losses, s.battles),
    },
    {
      label: "Draws",
      primary: integerFmt.format(s.draws),
      secondary: pctOrDash(s.draws, s.battles),
    },
    {
      label: "Battles survived",
      primary: integerFmt.format(s.survivedBattles),
      secondary: pctOrDash(s.survivedBattles, s.battles),
    },
    {
      label: "Tanks destroyed",
      primary: integerFmt.format(s.frags),
      secondary: avgOrDash(s.frags, s.battles),
    },
    {
      label: "Destruction ratio",
      primary: avgOrDash(s.frags, s.battles - s.survivedBattles),
    },
    {
      label: "Tanks spotted",
      primary: integerFmt.format(s.spotted),
      secondary: avgOrDash(s.spotted, s.battles),
    },
    { label: "Damages", primary: avgOrDash(s.damageDealt, s.battles) },
    { label: "Track damages", primary: derived(d.trackDamage.total) },
    { label: "Spotting damages", primary: derived(d.spottingDamage.total) },
    { label: "Assisting damages", primary: derived(d.assistingDamage.total) },
    { label: "Combined damages", primary: derived(d.combinedDamage.total) },
    {
      label: "Base capture",
      primary: integerFmt.format(s.capturePoints),
      secondary: avgOrDash(s.capturePoints, s.battles),
    },
    {
      label: "Base defense",
      primary: integerFmt.format(s.droppedCapturePoints),
      secondary: avgOrDash(s.droppedCapturePoints, s.battles),
    },
    { label: "Experience", primary: avgOrDash(s.xp, s.battles) },
    { label: "Hit rate", primary: pctOrDash(s.hits, s.shots) },
    { label: "Personal rating", primary: integerFmt.format(s.globalRating) },
    {
      label: "World of Tanks Rating",
      primary: s.wtr == null ? DASH : integerFmt.format(s.wtr),
    },
    { label: "WN7", primary: derived(d.wn7.total) },
    { label: "WN8", primary: derived(d.wn8.total) },
    { label: "WNX", primary: derived(d.wnx.total) },
  ];
}

/** The full stats table as an aligned code block for an embed description. */
export function buildStatsBlock(s: Stats, d: PlayerDerivedStats): string {
  return renderTable(statRows(s, d));
}
