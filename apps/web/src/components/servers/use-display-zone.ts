"use client";

import { useHydrated } from "@/hooks/use-hydrated";
import type { DisplayZone } from "./format";

/**
 * The timezone to render clock readings in: UTC until this tree has hydrated,
 * the reader's own from then on.
 *
 * Every timestamp on this page is rendered twice, once into the prerendered
 * HTML and once on the client. Production's container runs UTC while the reader
 * does not, so formatting in the runtime's own zone both times puts two
 * different strings in the two trees and React throws the subtree away. Pinning
 * the first render to UTC makes the two agree, and the swap to local happens on
 * the re-render React was going to do anyway. The rhythm heatmap solves the
 * same problem the same way, and says which of the two it is showing.
 */
export function useDisplayZone(): DisplayZone {
  return useHydrated() ? "local" : "UTC";
}
