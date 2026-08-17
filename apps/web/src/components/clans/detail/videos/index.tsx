"use client";

import { Swords } from "lucide-react";
import type { Region } from "@unicum.gg/wargaming";
import { Panel } from "@/components/panel";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  TankVideoPlayerProvider,
  useTankVideoPlayer,
} from "@/components/tanks/detail/videos/player";
import { VideoSection } from "@/components/tanks/detail/videos/section";
import { VideoPlayerSurface } from "@/components/tanks/detail/videos/surface";
import { useVideosView } from "@/components/tanks/detail/videos/view-toggle";
import { ClanTacticDialogSlot } from "./submit-dialog-slot";

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
 * A battle is still filed under the map it was fought on, the clan being a
 * field of that submission, but it can be suggested from here: someone watching
 * a clan's evening and spotting the moment worth linking should not have to
 * work out which map page to open first. The form seeds itself with the map of
 * the battle playing and lets the submitter move it, exactly as on a map page.
 *
 * Renders nothing at all when the clan has none.
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

  // Always reachable now, not only from a deep link: the nav keeps the tab even
  // at zero, so the empty state is an invitation rather than a dead end. A
  // tactic is filed under the ground it was fought on, so the way in is a map.
  if (videos.length === 0) {
    return (
      // The section nav above already draws the boundary line (its
      // `screen-line-after`), so this panel keeps only its own bottom line:
      // both together stack into a 2px double border above the empty state.
      <Panel screenLines={false} className="screen-line-after">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Swords />
            </EmptyMedia>
            <EmptyTitle>No tactics yet</EmptyTitle>
            <EmptyDescription>
              Nobody has credited [{tag}] on a tactic yet. Suggest one and pick
              the map it was played on. It shows up here once a moderator has
              looked at it.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ClanTacticDialogSlot region={region} />
          </EmptyContent>
        </Empty>
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
          action={<ClanTacticDialogSlot region={region} />}
        />
      </Panel>
    </>
  );
}
