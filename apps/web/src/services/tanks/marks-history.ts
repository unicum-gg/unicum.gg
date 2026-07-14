import "server-only";
import { unstable_cache } from "next/cache";
import {
  fetchMomHistoryFromPoliroid,
  type MomHistoryPoint,
} from "@unicum.gg/core/mom/poliroid";
import {
  fetchMoeHistoryFromPoliroid,
  type MoeHistoryPoint,
} from "@unicum.gg/core/moe/poliroid";
import type { Region } from "@unicum.gg/wargaming";

// Poliroid publishes a fresh daily aggregate, so a 6h cache keeps the chart
// current without hitting the provider on every page view. Both wrappers
// fail-open: a provider blip returns an empty history and the chart just hides.
const REVALIDATE_SECONDS = 6 * 60 * 60;

const moeHistoryCached = unstable_cache(
  (region: Region, tankId: number) => fetchMoeHistoryFromPoliroid(region, tankId),
  ["moe-history"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marks-history"] },
);

export async function getMoeHistory(
  region: Region,
  tankId: number,
): Promise<MoeHistoryPoint[]> {
  try {
    return await moeHistoryCached(region, tankId);
  } catch {
    return [];
  }
}

const momHistoryCached = unstable_cache(
  (region: Region, tankId: number) =>
    fetchMomHistoryFromPoliroid(region, tankId),
  ["mom-history"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marks-history"] },
);

export async function getMomHistory(
  region: Region,
  tankId: number,
): Promise<MomHistoryPoint[]> {
  try {
    return await momHistoryCached(region, tankId);
  } catch {
    return [];
  }
}
