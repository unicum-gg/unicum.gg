import { unstable_cache } from "next/cache";
import { getLiveStreamers } from "@unicum.gg/core/twitch/live";

/**
 * Live streamers for the home rail and the cross-site 🔴 badges, cached ~60s so
 * one render (and every badge lookup) shares a single Twitch poll instead of
 * hitting Helix per request. Reads from the same cache everywhere.
 */
export const getCachedLiveStreamers = unstable_cache(
  getLiveStreamers,
  ["live-streamers"],
  { revalidate: 30, tags: ["live-streamers"] },
);
