"use client";

import { useLiveStreamer } from "@/hooks/use-live-streamers";
import type { Region } from "@unicum.gg/wargaming";
import { cn } from "@/lib/utils";

/**
 * A small 🔴 LIVE pill shown next to a player wherever they appear (leaderboards,
 * clan members, player header) when they are streaming WoT right now. Renders
 * nothing when the player is offline. A plain `<span>` so it stays valid inside
 * the surrounding nickname link.
 */
export function LiveBadge({
  region,
  accountId,
  className,
}: {
  region: Region;
  accountId: number;
  className?: string;
}) {
  const streamer = useLiveStreamer(region, accountId);
  if (!streamer) return null;
  return (
    <a
      href={`https://www.twitch.tv/${streamer.twitchLogin}`}
      target="_blank"
      rel="nofollow noopener noreferrer"
      // Stop the click from bubbling to a surrounding row handler (e.g. the
      // home rail's select-row) so the badge always goes straight to Twitch.
      onClick={(e) => e.stopPropagation()}
      title={`Watch ${streamer.twitchUserName} on Twitch · ${streamer.viewerCount.toLocaleString("en-US")} viewers`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm bg-[#eb0400] px-1 align-middle text-[10px] font-bold uppercase leading-tight text-white transition-opacity hover:opacity-90",
        className,
      )}
    >
      Live
    </a>
  );
}
