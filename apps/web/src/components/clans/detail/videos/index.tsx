"use client";

import type { Region } from "@unicum.gg/wargaming";
import { Panel, PanelContent } from "@/components/panel";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  TankVideoPlayerProvider,
  useTankVideoPlayer,
} from "@/components/tanks/detail/videos/player";
import { VideoSection } from "@/components/tanks/detail/videos/section";
import { VideoPlayerSurface } from "@/components/tanks/detail/videos/surface";
import { useVideosView } from "@/components/tanks/detail/videos/view-toggle";

/** The element the player takes over, scrolled back into view when a card
 * further down the page is clicked. */
const CLAN_PLAYER_ID = "clan-video-player";

/**
 * What this clan has published: the tactics it called, on the ground it called
 * them on.
 *
 * The third view of the same rows, and the only one keyed to who was playing
 * rather than to what was played. A map page answers "how is this ground
 * fought"; this answers "how does this clan fight", which is what someone
 * scouting an opponent, or a recruit reading a clan's page, is actually after.
 *
 * Nothing is submitted from here: a battle is filed under the map it was fought
 * on, and the clan is a field of that submission. So this is a record, not a
 * desk, and it renders nothing at all when the clan has none.
 */
export function ClanVideosTab({
  region,
  tag,
  videos,
}: {
  region: Region;
  tag: string;
  /** Fetched by the page, which needs the count for the nav anyway. Undefined
   * while it is in flight. */
  videos: TankVideoCardData[] | undefined;
}) {
  if (!videos) return null;

  // Reachable from a link or a reload even though the nav hides the tab for a
  // clan with none, so it says what it would show rather than nothing at all.
  if (videos.length === 0) {
    return (
      <Panel>
        <PanelContent>
          <p className="py-12 text-center text-sm text-fd-muted-foreground">
            Nobody has credited [{tag}] on a tactic yet. They are suggested from
            the map pages: open the map a battle was fought on, link the video,
            and name the clan that played it.
          </p>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <TankVideoPlayerProvider
      region={region}
      videos={videos}
      anchorId={CLAN_PLAYER_ID}
    >
      <ClanVideos videos={videos} region={region} tag={tag} />
    </TankVideoPlayerProvider>
  );
}

function ClanVideos({
  videos,
  region,
  tag,
}: {
  videos: TankVideoCardData[];
  region: Region;
  tag: string;
}) {
  const player = useTankVideoPlayer();
  const [view, setView] = useVideosView();

  return (
    <>
      {player?.current ? (
        <Panel>
          <div id={CLAN_PLAYER_ID} className="aspect-video w-full">
            <VideoPlayerSurface />
          </div>
        </Panel>
      ) : (
        <div id={CLAN_PLAYER_ID} />
      )}

      <Panel>
        <VideoSection
          region={region}
          title={`[${tag}] videos`}
          battles={player?.videos ?? videos}
          view={view}
          onViewChange={setView}
          // Crossing maps, unlike a map's own lists: which ground a tactic was
          // called on is the first thing worth reading here.
          showMap
          emptyText=""
        />
      </Panel>
    </>
  );
}
