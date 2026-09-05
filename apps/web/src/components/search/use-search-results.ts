"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import type { MapSearchResult } from "@/app/api/[region]/maps/search/route";
import { SearchType } from "@/components/search/filter-bar";
import {
  type Outcome,
  type SearchSections,
  type Section,
  deriveSection,
  previousOf,
} from "@/components/search/row-model";
import { mergeSearchChunks } from "@/lib/search-merge";
import { unicum } from "@/services/sdk";
import {
  SearchSource,
  type ClanSearchResult,
  type GlossarySummary,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const DEBOUNCE_MS = 250;

/** A chunk of a section's NDJSON stream, read for its shape only: what each row
 * holds is the section's business, and it casts. */
type Chunk = { source: SearchSource; results: unknown[] };

/** What a section has received so far: each source's latest chunk, and every
 * chunk in arrival order. Both are kept because the sections read them
 * differently, and neither can be recovered from the other. */
type Received<T> = { local: T[]; remote: T[]; all: T[] };

/** How a section turns what it received into the list it shows: the two entity
 * searches merge the two sources into one capped list (exact match hoisted)
 * instead of appending, so the section stays at one page and the count doesn't
 * double when the Wargaming chunk lands. */
type Fold<T> = (received: Received<T>) => T[];

/** Every chunk, in the order it arrived. What a section whose stream is a walk
 * rather than a local-then-remote pair wants: it keeps a second chunk of the
 * same source instead of letting it replace the first. */
function append<T>(received: Received<T>): T[] {
  return received.all;
}

/**
 * Every section of the search dialog, fetched.
 *
 * Kept out of the dialog because it is the whole of what the dialog does that
 * is not rendering: five independent searches, each debounced on the same
 * keystroke, each settling on its own. The dialog reads the sections and the
 * aggregate status, and never a request.
 */
export function useSearchResults({
  region,
  searchType,
  trimmedQuery,
  minQueryLength,
  onFirstResults,
}: {
  region: Region;
  searchType: SearchType;
  trimmedQuery: string;
  minQueryLength: number;
  /** Called when a section's instant (local) chunk lands, so the caller can put
   * the keyboard highlight back on the first row. */
  onFirstResults: () => void;
}) {
  const [players, setPlayers] = useState<Outcome<SearchPlayerResult> | null>(
    null,
  );
  const [clans, setClans] = useState<Outcome<ClanSearchResult> | null>(null);
  const [tanks, setTanks] = useState<Outcome<TankSearchResult> | null>(null);
  const [maps, setMaps] = useState<Outcome<MapSearchResult> | null>(null);
  const [glossary, setGlossary] = useState<Outcome<GlossarySummary> | null>(
    null,
  );

  // Held in a ref, not read as a dependency: it is something the hook tells the
  // caller, never something a search depends on. As a dependency, a caller that
  // wrote the callback inline would abort and re-issue all five requests on
  // every render it caused, forever.
  const notifyFirstResults = useRef(onFirstResults);
  useEffect(() => {
    notifyFirstResults.current = onFirstResults;
  }, [onFirstResults]);
  const onLocalChunk = useCallback(() => notifyFirstResults.current(), []);

  const wantPlayers =
    searchType === SearchType.All || searchType === SearchType.Players;
  const wantClans =
    searchType === SearchType.All || searchType === SearchType.Clans;
  const wantTanks =
    searchType === SearchType.All || searchType === SearchType.Tanks;
  const wantMaps =
    searchType === SearchType.All || searchType === SearchType.Maps;
  const wantGlossary =
    searchType === SearchType.All || searchType === SearchType.Glossary;

  useEffect(() => {
    // A disabled section (`!wantX`) or a too-short query is hidden by
    // `deriveSection`, which also ignores an outcome left over from another
    // query — so there's nothing to clear here, we just skip fetching.
    if (trimmedQuery.length < minQueryLength) return;

    const controller = new AbortController();
    const signal = controller.signal;
    const timer = setTimeout(() => {
      if (wantPlayers) {
        void runStream(
          setPlayers,
          trimmedQuery,
          onLocalChunk,
          () =>
            unicum.region(region).players.searchStream(trimmedQuery, { signal }),
          ({ local, remote }) =>
            mergeSearchChunks(local, remote, (r) => r.nickname, trimmedQuery),
        );
      }
      if (wantClans) {
        void runStream(
          setClans,
          trimmedQuery,
          onLocalChunk,
          () =>
            unicum.region(region).clans.searchStream(trimmedQuery, { signal }),
          ({ local, remote }) =>
            mergeSearchChunks(local, remote, (r) => r.tag, trimmedQuery),
        );
      }
      if (wantTanks) {
        void runStream(
          setTanks,
          trimmedQuery,
          onLocalChunk,
          () =>
            unicum.region(region).tanks.searchStream(trimmedQuery, { signal }),
          append,
        );
      }
      if (wantMaps) {
        void runStream(
          setMaps,
          trimmedQuery,
          onLocalChunk,
          () => unicum.region(region).maps.searchStream(trimmedQuery, { signal }),
          append,
        );
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    trimmedQuery,
    minQueryLength,
    region,
    wantPlayers,
    wantClans,
    wantTanks,
    wantMaps,
    onLocalChunk,
  ]);

  // The glossary has an effect of its own because it does not have a region: a
  // definition reads the same on every server, so sharing the one above would
  // re-issue it, and flash its loading bar, every time the reader switches
  // region for an answer that cannot differ.
  useEffect(() => {
    if (!wantGlossary || trimmedQuery.length < minQueryLength) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setGlossary((prev) => ({
        status: "loading",
        previous: previousOf(prev),
        forQuery: trimmedQuery,
      }));
      void (async () => {
        try {
          // A plain request, not a stream: the catalogue ships with the build,
          // so there is no slow half to wait on. The SDK's handle takes no
          // abort signal, so a superseded answer is dropped on arrival rather
          // than cancelled in flight — it costs one local request, and going
          // around the SDK to save it is not allowed.
          const { results } = await unicum.glossary.search(trimmedQuery);
          if (cancelled) return;
          setGlossary({
            status: "ok",
            results: results as unknown as GlossarySummary[],
            forQuery: trimmedQuery,
          });
          // Deliberately no `onLocalChunk` here: the glossary renders last, so
          // its arrival shifts no row above it, and resetting the highlight
          // would undo the reader's arrow keys while they were still typing.
        } catch {
          if (cancelled) return;
          setGlossary({ status: "error", forQuery: trimmedQuery });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, minQueryLength, wantGlossary]);

  const playersSection = useMemo(
    () => deriveSection(wantPlayers, trimmedQuery, minQueryLength, players),
    [wantPlayers, trimmedQuery, minQueryLength, players],
  );
  const clansSection = useMemo(
    () => deriveSection(wantClans, trimmedQuery, minQueryLength, clans),
    [wantClans, trimmedQuery, minQueryLength, clans],
  );
  const tanksSection = useMemo(
    () => deriveSection(wantTanks, trimmedQuery, minQueryLength, tanks),
    [wantTanks, trimmedQuery, minQueryLength, tanks],
  );
  const mapsSection = useMemo(
    () => deriveSection(wantMaps, trimmedQuery, minQueryLength, maps),
    [wantMaps, trimmedQuery, minQueryLength, maps],
  );
  const glossarySection = useMemo(
    () => deriveSection(wantGlossary, trimmedQuery, minQueryLength, glossary),
    [wantGlossary, trimmedQuery, minQueryLength, glossary],
  );

  // Only the sections the filter actually asks for: a section the reader turned
  // off is neither loading nor empty, and counting it as "not empty" is what
  // used to swallow the "No results found" line whenever the filter was set to
  // anything but All.
  const active: Section<unknown>[] = [
    wantPlayers ? playersSection : null,
    wantClans ? clansSection : null,
    wantTanks ? tanksSection : null,
    wantMaps ? mapsSection : null,
    wantGlossary ? glossarySection : null,
  ].filter((s) => s !== null);
  const sections: SearchSections = useMemo(
    () => ({
      players: playersSection.visible,
      clans: clansSection.visible,
      tanks: tanksSection.visible,
      maps: mapsSection.visible,
      glossary: glossarySection.visible,
    }),
    [
      playersSection.visible,
      clansSection.visible,
      tanksSection.visible,
      mapsSection.visible,
      glossarySection.visible,
    ],
  );

  const reset = useCallback(() => {
    setPlayers(null);
    setClans(null);
    setTanks(null);
    setMaps(null);
    setGlossary(null);
  }, []);

  return {
    sections,
    anyLoading: active.some((s) => s.isLoading),
    allErrored: active.length > 0 && active.every((s) => s.isError),
    allEmpty: active.length > 0 && active.every((s) => s.isEmpty),
    reset,
  };
}

/**
 * Drive one section from its NDJSON stream.
 *
 * The section stays in `streaming` until the stream closes, so partial results
 * show with the loading indicator still on and the empty state can't flash
 * before the Wargaming chunk arrives.
 */
async function runStream<T>(
  setOutcome: Dispatch<SetStateAction<Outcome<T> | null>>,
  forQuery: string,
  onFirstResults: () => void,
  open: () => AsyncGenerator<Chunk>,
  fold: Fold<T>,
): Promise<void> {
  setOutcome((prev) => ({
    status: "loading",
    previous: previousOf(prev),
    forQuery,
  }));
  const received: Received<T> = { local: [], remote: [], all: [] };
  try {
    for await (const chunk of open()) {
      const results = chunk.results as T[];
      if (chunk.source === SearchSource.Local) received.local = results;
      else received.remote = results;
      received.all = [...received.all, ...results];
      setOutcome({ status: "streaming", results: fold(received), forQuery });
      if (chunk.source === SearchSource.Local) onFirstResults();
    }
    setOutcome({ status: "ok", results: fold(received), forQuery });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
    setOutcome({ status: "error", forQuery });
  }
}
