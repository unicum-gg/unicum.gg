import { unstable_cache } from "next/cache";
import { getChatBadges } from "@unicum.gg/core/twitch";
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

/**
 * A channel's chat badges, cached for an hour per login: badge sets change when
 * a streamer uploads new subscriber art, which is rare, while a chat client asks
 * each time it joins the channel.
 */
export const getCachedChatBadges = unstable_cache(
  getChatBadges,
  ["twitch-chat-badges"],
  { revalidate: 3600, tags: ["twitch-chat-badges"] },
);
