"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { BattleFormat, isCompetitiveFormat } from "@unicum.gg/shared";
import type { MapDetail } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { Panel, PanelSeparator } from "@/components/panel";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  TankVideoPlayerProvider,
  useTankVideoPlayer,
} from "@/components/tanks/detail/videos/player";
import { VideoPlayerSurface } from "@/components/tanks/detail/videos/surface";
import { useVideosView } from "@/components/tanks/detail/videos/view-toggle";
import { unicum } from "@/services/sdk";
import { VideoSection } from "@/components/tanks/detail/videos/section";
import { SubmitTacticDialogSlot } from "./submit-dialog-slot";

/** The element the player takes over, scrolled back into view when a card
 * further down the page is clicked. */
const MAP_PLAYER_ID = "map-video-player";

/**
 * The battles the community has linked on this map.
 *
 * The read behind a tactic library. A tank page fixes the vehicle and varies the
 * ground; here the ground is fixed and what varies is the format, the side and
 * who was playing, which is exactly what someone calling shots for a clan is
 * looking for.
 *
 * Fetched from the browser rather than rendered into the page: the map pages
 * are cached for an hour, and a tactic approved ten minutes ago should not have
 * to wait that out. It also keeps the section off the critical path of a page
 * whose subject is the minimap above it.
 */
export function MapVideosPanel({
  region,
  map,
  initialVideos,
}: {
  region: Region;
  map: MapDetail;
  /** Rendered by the server. SWR still revalidates on top, which is what picks
   * up a tactic approved since this page was cached. */
  initialVideos: TankVideoCardData[];
}) {
  const slug = map.slug;
  const { data: videos = initialVideos } = useSWR(
    `map-videos:${region}:${slug}`,
    () =>
      unicum
        .region(region)
        .maps(slug)
        .videos()
        .then((r) => r.videos as unknown as TankVideoCardData[]),
    { fallbackData: initialVideos },
  );

  return (
    <TankVideoPlayerProvider
      region={region}
      videos={videos}
      // This map's own queued rows, out of the reader's whole queue.
      ownMapSlug={slug}
      anchorId={MAP_PLAYER_ID}
    >
      <MapVideos videos={videos} region={region} map={map} />
    </TankVideoPlayerProvider>
  );
}

function MapVideos({
  videos: published,
  region,
  map,
}: {
  videos: TankVideoCardData[];
  region: Region;
  map: MapDetail;
}) {
  // The provider merges in the reader's own queued battles, so the lists and
  // the player's seek bar show the same set.
  const player = useTankVideoPlayer();
  const all = player?.videos ?? published;
  const [view, setView] = useVideosView();

  // Two lists, because they answer two questions. A tactic is something to
  // prepare from, a random battle something to watch, and one list holding both
  // left the format filter as the only thing saying which was which.
  const { tactics, randoms } = useMemo(() => {
    const tactics: TankVideoCardData[] = [];
    const randoms: TankVideoCardData[] = [];
    for (const v of all) {
      if (isCompetitiveFormat(v.format ?? BattleFormat.Random)) tactics.push(v);
      else randoms.push(v);
    }
    return { tactics, randoms };
  }, [all]);

  return (
    <>
      {/* The player sits above both lists rather than over the minimap: the
          minimap is what makes a tactic readable, so covering it with the video
          it explains would be the wrong trade. */}
      {player?.current ? (
        <>
          <Panel>
            <div id={MAP_PLAYER_ID} className="aspect-video w-full">
              <VideoPlayerSurface />
            </div>
          </Panel>
          <PanelSeparator />
        </>
      ) : (
        <div id={MAP_PLAYER_ID} />
      )}

      <Panel>
        <VideoSection
          region={region}
          title={`${map.name} tactics`}
          battles={tactics}
          view={view}
          onViewChange={setView}
          emptyText={`No tactic linked on ${map.name} yet. Suggest one and it shows up here once a moderator has looked at it.`}
          action={<SubmitTacticDialogSlot region={region} map={map} />}
        />
      </Panel>

      {/* Only when there are any. Nothing is submitted here from this page, so
          an empty heading would be a section apologising for itself. */}
      {randoms.length > 0 && (
        <>
          <PanelSeparator />
          <Panel>
            <VideoSection
              region={region}
              title="Random battles"
              battles={randoms}
              view={view}
              emptyText=""
            />
          </Panel>
        </>
      )}
    </>
  );
}
