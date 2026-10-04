import type { MapHistoryVersion } from "@/components/maps/detail/history";

/**
 * What the history endpoint returns, as the page hands it down.
 *
 * Its own module rather than a type exported from the panel, because the layout
 * reads it too: it needs nothing from the payload but `tracked`, to decide
 * whether this map has a History tab at all, and importing a client component's
 * types to answer that would drag the panel into the layout's graph.
 *
 * Null when the endpoint could not be read at render time.
 */
export type MapHistoryData = {
  versions: MapHistoryVersion[];
  addedVersion: string | null;
  addedAt: string | Date | null;
  removedVersion: string | null;
  removedAt: string | Date | null;
  present: boolean;
  tracked: boolean;
  testVersion: string | null;
  testChanges: { field: string; previous: string | null; next: string | null }[];
} | null;
