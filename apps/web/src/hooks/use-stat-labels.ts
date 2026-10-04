"use client";

import { useMemo } from "react";
import { composeStatLabels } from "@/lib/stat-labels";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The client half of the stat-label translator.
 *
 * Anything that renders a table heading through `statLabel` reads it from here
 * rather than from `useTranslation("components/stat-labels")`, so a heading
 * that is one of the game's own names comes off `game/vocabulary` instead of
 * being translated a second time. `composeStatLabels` says why. The server half
 * is `getStatLabels` in `lib/translations.server`.
 *
 * Memoized because a composition is a new closure on every render, and a table
 * that lists its translator among a memo's dependencies would then rebuild its
 * rows every time anything else moved. The pagination hook treats a new array
 * as a new list and resets the page DURING render, so the cost of an unstable
 * identity here is a reader losing their `?page=` rather than a slow table.
 */
export function useStatLabels() {
  const { t: tStats } = useTranslation("components/stat-labels");
  const { t: tGame } = useTranslation("game/vocabulary");
  return useMemo(
    () => ({ t: composeStatLabels(tStats, tGame) }),
    [tStats, tGame],
  );
}
