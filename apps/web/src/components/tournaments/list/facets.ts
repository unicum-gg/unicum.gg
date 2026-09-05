"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TournamentGameMode } from "@unicum.gg/wargaming";

/**
 * The only fields the facets read.
 *
 * Declared here rather than taken from the catalogue's row so the same bar can
 * filter any list of tournaments: the clan tab's entries carry the tournament
 * they belong to and nothing else in common with a catalogue row, and a filter
 * that reads five fields should not demand the other twenty.
 */
export type FacetableTournament = {
  gameModes: TournamentGameMode[];
  minPlayersInTeam: number;
  tierFrom: number | null;
  tierTo: number | null;
  isFeatured: boolean;
};

/**
 * The catalogue's discrete filters: which battle type, which team size, which
 * tier.
 *
 * Facets rather than a min/max range, because none of the three is a magnitude
 * a reader wants a band of. The question is "show me the 7v7 Onslaughts", and
 * that is a set of values, not an interval.
 *
 * Every option is DERIVED from the rows on screen rather than listed here, so a
 * battle type Wargaming adds appears on its own and one that stops running
 * stops being offered. An empty selection means "no filter", which is what
 * makes the bar start out of the way.
 */
export type TournamentFacets = {
  modes: TournamentGameMode[];
  modesSel: Set<TournamentGameMode>;
  toggleMode: (mode: TournamentGameMode) => void;
  sizes: number[];
  sizesSel: Set<number>;
  toggleSize: (size: number) => void;
  tiers: number[];
  tiersSel: Set<number>;
  toggleTier: (tier: number) => void;
  /**
   * Only the events Wargaming itself flags.
   *
   * `is_featured` is their editorial signal and it separates the two kinds of
   * tournament that otherwise sit in one undifferentiated list: the AMD Clan
   * Showdowns, the Onslaught Legends Series, the championships paying cash, as
   * against the automated dailies numbered to N°51. We already stored it and
   * never showed it.
   */
  featuredOnly: boolean;
  toggleFeatured: () => void;
  /** Whether the catalogue holds any, so the control can hide itself. */
  hasFeatured: boolean;
  /** Whether anything is selected, so the bar can offer a way out. */
  active: boolean;
  clear: () => void;
};

/** The tiers a tournament admits, since a band of VIII-X answers to all three. */
function tiersOf(row: FacetableTournament): number[] {
  const from = row.tierFrom ?? row.tierTo;
  const to = row.tierTo ?? row.tierFrom;
  if (from === null || to === null) return [];
  const out: number[] = [];
  for (let tier = Math.min(from, to); tier <= Math.max(from, to); tier++) {
    out.push(tier);
  }
  return out;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const csv = (set: Set<string | number>) => [...set].join(",");

/**
 * Reads and writes `?mode=`, `?size=` and `?tier=` as comma-separated lists,
 * the same shape the array query params on our own API use, so a filtered
 * catalogue is a link someone can send.
 */
export function useTournamentFacets<T extends FacetableTournament>(
  rows: T[],
  /** Mirror the selection to the URL. Off where two filtered lists could
   * otherwise fight over the same query params. */
  syncUrl = true,
): {
  facets: TournamentFacets;
  filtered: T[];
} {
  const [modesSel, setModes] = useState<Set<TournamentGameMode>>(new Set());
  const [sizesSel, setSizes] = useState<Set<number>>(new Set());
  const [tiersSel, setTiers] = useState<Set<number>>(new Set());
  const [featuredOnly, setFeatured] = useState(false);

  const modes = useMemo(() => {
    const seen = new Set<TournamentGameMode>();
    for (const row of rows) for (const mode of row.gameModes) seen.add(mode);
    return [...seen].sort();
  }, [rows]);
  const sizes = useMemo(
    () => [...new Set(rows.map((r) => r.minPlayersInTeam))].sort((a, b) => a - b),
    [rows],
  );
  const tiers = useMemo(() => {
    const seen = new Set<number>();
    for (const row of rows) for (const tier of tiersOf(row)) seen.add(tier);
    return [...seen].sort((a, b) => a - b);
  }, [rows]);

  // Seed from the URL once on mount, client-only so the static page stays
  // static and there is no SSR mismatch. Same shape as the leaderboard filter's
  // own seeding.
  const seeded = useRef(false);
  useEffect(() => {
    if (!syncUrl || seeded.current) return;
    seeded.current = true;
    const params = new URLSearchParams(window.location.search);
    const read = (key: string) =>
      (params.get(key) ?? "").split(",").filter(Boolean);
    /* eslint-disable react-hooks/set-state-in-effect -- deep link is only readable client-side after mount (the page is static) */
    const mode = read("mode") as TournamentGameMode[];
    if (mode.length) setModes(new Set(mode));
    const size = read("size").map(Number).filter(Number.isFinite);
    if (size.length) setSizes(new Set(size));
    const tier = read("tier").map(Number).filter(Number.isFinite);
    if (tier.length) setTiers(new Set(tier));
    if (params.get("featured") === "1") setFeatured(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const write = useCallback(
    (
      next: Partial<{
        mode: Set<TournamentGameMode>;
        size: Set<number>;
        tier: Set<number>;
        featured: boolean;
      }>,
    ) => {
      if (!syncUrl) return;
      const params = new URLSearchParams(window.location.search);
      const setOrDel = (key: string, value: string) => {
        if (value) params.set(key, value);
        else params.delete(key);
      };
      setOrDel("mode", csv(next.mode ?? modesSel));
      setOrDel("size", csv(next.size ?? sizesSel));
      setOrDel("tier", csv(next.tier ?? tiersSel));
      setOrDel("featured", (next.featured ?? featuredOnly) ? "1" : "");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    },
    [modesSel, sizesSel, tiersSel, featuredOnly, syncUrl],
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (featuredOnly && !row.isFeatured) return false;
        if (modesSel.size && !row.gameModes.some((m) => modesSel.has(m))) {
          return false;
        }
        if (sizesSel.size && !sizesSel.has(row.minPlayersInTeam)) return false;
        if (tiersSel.size && !tiersOf(row).some((t) => tiersSel.has(t))) {
          return false;
        }
        return true;
      }),
    [rows, featuredOnly, modesSel, sizesSel, tiersSel],
  );

  const facets: TournamentFacets = {
    modes,
    modesSel,
    toggleMode: (mode) => {
      const next = toggle(modesSel, mode);
      setModes(next);
      write({ mode: next });
    },
    sizes,
    sizesSel,
    toggleSize: (size) => {
      const next = toggle(sizesSel, size);
      setSizes(next);
      write({ size: next });
    },
    tiers,
    tiersSel,
    toggleTier: (tier) => {
      const next = toggle(tiersSel, tier);
      setTiers(next);
      write({ tier: next });
    },
    featuredOnly,
    toggleFeatured: () => {
      const next = !featuredOnly;
      setFeatured(next);
      write({ featured: next });
    },
    hasFeatured: rows.some((r) => r.isFeatured),
    active:
      featuredOnly || modesSel.size > 0 || sizesSel.size > 0 || tiersSel.size > 0,
    clear: () => {
      setModes(new Set());
      setSizes(new Set());
      setTiers(new Set());
      setFeatured(false);
      write({
        mode: new Set(),
        size: new Set(),
        tier: new Set(),
        featured: false,
      });
    },
  };

  return { facets, filtered };
}
