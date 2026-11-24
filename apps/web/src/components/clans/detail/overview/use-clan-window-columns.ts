"use client";

import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import {
  DEFAULT_STAT_WINDOWS,
  sameStatWindow,
  type ClanStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import { StatWindowScope, useStatWindows } from "@/hooks/use-stat-windows";
import { unicum } from "@/services/sdk";

/** One column of the clan tables: the payload's own (`custom` false), or a
 * window read from the clan period endpoint, undefined while on its way and
 * null when that read failed. */
export type ClanWindowColumn =
  | { custom: false; index: 0 | 1 | 2 }
  | { custom: true; data: ClanStatWindow | null | undefined };

function useClanWindowColumn(
  region: Region,
  tag: string,
  window: StatWindow,
): ClanWindowColumn {
  const index = DEFAULT_STAT_WINDOWS.findIndex((w) => sameStatWindow(w, window));
  const request = () => unicum.region(region).clans(tag).period(window.value);
  const { data, error } = useSWR(
    index === -1 ? request().url() : null,
    () => request().then((r) => r as unknown as ClanStatWindow),
    { revalidateOnFocus: false },
  );
  if (index !== -1) return { custom: false, index: index as 0 | 1 | 2 };
  return { custom: true, data: error ? null : data };
}

/**
 * The three period columns of the clan's tables, over the windows the reader
 * set (days only, see `StatWindowScope.Clan`). One read covers both tables,
 * since the Stronghold and Global Map figures share a snapshot.
 */
export function useClanWindowColumns(
  region: Region,
  tag: string,
): readonly [ClanWindowColumn, ClanWindowColumn, ClanWindowColumn] {
  const [windows] = useStatWindows(StatWindowScope.Clan);
  // One call per slot, always three: hooks cannot follow a loop over data.
  return [
    useClanWindowColumn(region, tag, windows[0]),
    useClanWindowColumn(region, tag, windows[1]),
    useClanWindowColumn(region, tag, windows[2]),
  ];
}

const PAYLOAD_KEYS = ["h24", "d7", "d30"] as const;

/**
 * One table's period values from the columns: the payload's where the window
 * is a default, the custom read's otherwise (undefined while loading, null on
 * a failed read or no comparison point).
 */
export function windowedPeriods<T>(
  columns: readonly ClanWindowColumn[],
  payload: { h24: T | null; d7: T | null; d30: T | null },
  pick: (w: ClanStatWindow) => T | null,
): { h24: T | null | undefined; d7: T | null | undefined; d30: T | null | undefined } {
  const at = (c: ClanWindowColumn) =>
    !c.custom ? payload[PAYLOAD_KEYS[c.index]] : c.data === undefined ? undefined : c.data && pick(c.data);
  return { h24: at(columns[0]), d7: at(columns[1]), d30: at(columns[2]) };
}

/** The truncation note of a column, for its heading. */
export function windowNote(column: ClanWindowColumn): { truncated: boolean; from: Date | null } {
  return column.custom && column.data
    ? { truncated: column.data.truncated, from: column.data.from }
    : { truncated: false, from: null };
}
