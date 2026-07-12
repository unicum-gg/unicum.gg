import { publish } from "@unicum.gg/core/live/pubsub";
import { getLiveStreamers } from "@unicum.gg/core/twitch/live";

/** LiveSync channel the live-streamers snapshot is published on. */
export const LIVE_STREAMERS_CHANNEL = "streamers:live";

const POLL_MS = 5_000;

declare global {
  var __liveStreamersPoller: NodeJS.Timeout | undefined;
}

/**
 * Single deployment-wide poller: fetch the live streamers every few seconds and
 * publish them on the LiveSync channel, so every web instance pushes the update
 * to its SSE clients from ONE Twitch poll (not one per instance, and not one
 * per connected browser like the old SWR polling). Runs in the cron process
 * (the worker in prod, the dev server locally), gated by the same `RUN_CRONS`
 * switch. HMR/double-start guarded via `globalThis`.
 */
export function startLiveStreamersPoller(): void {
  if (globalThis.__liveStreamersPoller) return;
  const tick = async () => {
    try {
      publish(LIVE_STREAMERS_CHANNEL, await getLiveStreamers());
    } catch (err) {
      console.error("[live-streamers] poll failed:", err);
    }
  };
  void tick();
  globalThis.__liveStreamersPoller = setInterval(tick, POLL_MS);
}
