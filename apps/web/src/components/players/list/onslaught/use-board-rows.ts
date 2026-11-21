"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import type { OnslaughtDropoutRow } from "@/components/players/list/onslaught/dropouts";
import type { OnslaughtRow } from "@/components/players/list/onslaught/row";
import PAGINATION from "@/constants/pagination";
import { parsePage } from "@/components/table-pager";
import { sharedParamStore } from "@/lib/url-param-store";
import { unicum } from "@/services/sdk";
import type { OnslaughtAggregates } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Where the board's rows come from, which is the whole subject of this file.
 *
 * The server hands over ONE page of the standings and the pager navigates for
 * the next, which is what took the Onslaught page from 3,996,734 octets to a
 * fraction of it: three thousand rows were shipped so a browser could draw a
 * hundred, average them for the panels, and hold the rest against a search box.
 *
 * The panels read the aggregates the endpoint folds over every ranked row, so
 * nothing on screen is computed from a page. What genuinely wants the rows is
 * the reader's own narrowing, since narrowing a hundred of them would answer
 * about the page rather than about the board, so the rest is fetched the moment
 * one of those is used and not before. A reader who only reads the board never
 * pays for it, and one who searches pays once.
 */
export function useOnslaughtBoardRows({
  region,
  seasonId,
  results,
  dropouts,
  ranked,
  page,
  narrowing,
}: {
  region: Region;
  /** The season these rows are of, so a page fetch cannot land on another one
   * if the current season rolled over after this page was prerendered. */
  seasonId: string | null;
  /** The page of the standings the server rendered. */
  results: OnslaughtRow[];
  /** The page of the lost places the server rendered. */
  dropouts: OnslaughtDropoutRow[];
  /** The board's own length, from the aggregates. */
  ranked: OnslaughtAggregates["ranked"];
  /** The page this render is of, from the route's own `/page/[n]` segment. */
  page?: number;
  /** Whether a control that narrows or reorders the BOARD is in use. */
  narrowing: boolean;
}): {
  /** The standings the board should work over: its page, another page, or all
   * of them once a control has asked for them. */
  source: OnslaughtRow[];
  /** The lost places, following the same fetch. */
  lostRows: OnslaughtDropoutRow[];
  /** The board's length while `source` is only a page of it, and undefined once
   * the rows really are all here. */
  serverTotal: number | undefined;
  /** Whether the whole board has been asked for, and the way to ask. The filter
   * bar is read after this hook runs, so the board arms it from there too. */
  wantFull: boolean;
  requestFull: () => void;
  /** Asked for and not yet here. What the board holds is a page, so nothing
   * counted over it may be presented as counted over the board. */
  pending: boolean;
} {
  const [wantFull, setWantFull] = useState(false);
  if (narrowing && !wantFull) setWantFull(true);

  // Both fetches ask this season for a different slice of it, so the query is
  // built once. The season is named explicitly rather than left to default:
  // this page is prerendered, and a season that rolled over since would
  // otherwise page into a different board than the one on screen.
  const slice = useCallback(
    (take: number, skip: number) =>
      unicum.region(region).players.onslaught({
        limit: take,
        ...(skip ? { offset: skip } : {}),
        ...(seasonId ? { season: seasonId } : {}),
      }),
    [region, seasonId],
  );

  const size = PAGINATION.SIZE.LEADERBOARD;
  // `?page=` is read through the shared param store rather than held here, so
  // the board and its pager cannot disagree about which page is on screen.
  const pageStore = sharedParamStore(PAGINATION.PARAM);
  const urlPage = useSyncExternalStore(
    pageStore.subscribe,
    pageStore.read,
    () => null,
  );
  const wanted = parsePage(urlPage) ?? page ?? 1;
  const elsewhere = wanted !== (page ?? 1);

  // The page the server rendered is in hand; any other is a fetch of a hundred
  // rows, which is what a page click costs now that the payload no longer
  // carries the whole board.
  const { data: pageData } = useSWR(
    !wantFull && elsewhere
      ? (["onslaught-page", region, seasonId, wanted] as const)
      : null,
    () => slice(size, (wanted - 1) * size),
    { keepPreviousData: true, revalidateOnFocus: false },
  );
  const { data: fullData } = useSWR(
    wantFull ? (["onslaught-full", region, seasonId, ranked] as const) : null,
    () => slice(Math.max(ranked, size), 0),
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  return {
    source: (fullData?.results ??
      (elsewhere ? (pageData?.results ?? results) : results)) as OnslaughtRow[],
    // The lost list follows the same fetch, since opening its tab is one of the
    // things that armed it.
    lostRows: (fullData?.dropouts ?? dropouts) as OnslaughtDropoutRow[],
    // Server-cut until that fetch lands, after which the rows really are all
    // here and the pager slices them as it always did.
    serverTotal: fullData ? undefined : ranked,
    wantFull,
    requestFull: () => setWantFull(true),
    pending: wantFull && !fullData,
  };
}
