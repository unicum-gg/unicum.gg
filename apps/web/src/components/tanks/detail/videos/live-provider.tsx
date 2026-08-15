"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import { unicum } from "@/services/sdk";
import type { TankVideoCardData } from "./card";
import { TankVideoPlayerProvider } from "./player";

/**
 * Wraps the tank page's video player provider with a browser-side revalidation
 * of the published list, mirroring the map side (see maps/detail/videos).
 *
 * The tank shell is server-rendered and its HTML is held for the page's ISR
 * window (and by the CDN on top), which `revalidatePath` drops from Next but not
 * from the edge, so a video approved since would otherwise wait that out. SWR
 * re-reads the list on arrival with the server render as fallback, so a freshly
 * approved video shows without a stale shell holding it back. The provider
 * merges the reader's own queued rows on top, as before.
 */
export function TankVideosLiveProvider({
  region,
  slug,
  initialVideos,
  children,
}: {
  region: Region;
  slug: string;
  /** The server render, used as the SWR fallback so first paint is immediate. */
  initialVideos: TankVideoCardData[];
  children: ReactNode;
}) {
  const { data: videos = initialVideos } = useSWR(
    `tank-videos:${region}:${slug}`,
    () =>
      unicum
        .region(region)
        .tanks(slug)
        .videos()
        .then((r) => r.videos as unknown as TankVideoCardData[]),
    { fallbackData: initialVideos },
  );

  return (
    <TankVideoPlayerProvider region={region} videos={videos} ownTankSlug={slug}>
      {children}
    </TankVideoPlayerProvider>
  );
}
