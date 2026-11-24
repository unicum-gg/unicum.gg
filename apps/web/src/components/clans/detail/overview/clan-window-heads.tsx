"use client";

import type { ReactNode } from "react";
import { StatWindowHead } from "@/components/stat-window/head";
import { StatWindowScope } from "@/hooks/use-stat-windows";
import { type ClanWindowColumn, windowNote } from "./use-clan-window-columns";

/** The three period headings of a clan table, each with its pencil and, for a
 * window reaching past our history, the date it really starts from. */
export function clanWindowHeads(
  columns: readonly [ClanWindowColumn, ClanWindowColumn, ClanWindowColumn],
): readonly [ReactNode, ReactNode, ReactNode] {
  const head = (slot: 0 | 1 | 2) => (
    <StatWindowHead
      key={slot}
      scope={StatWindowScope.Clan}
      slot={slot}
      {...windowNote(columns[slot])}
    />
  );
  return [head(0), head(1), head(2)];
}
