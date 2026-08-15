"use client";

import Link from "next/link";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import ROUTES from "@/constants/routes";
import { TankVideoCard, type TankVideoCardData } from "./card";
import { groupBattlesByVideo, PREVIEW_VIDEO_COUNT } from "./group";
import { useTankVideoPlayer } from "./player";
import { SubmitVideoDialogSlot } from "./submit-dialog-slot";
import { VideosTable } from "./table";
import { useVideosView, VideosView, VideosViewToggle } from "./view-toggle";

/**
 * The Videos tab: battles the community linked, each opening at the minute this
 * tank is played.
 *
 * Shown even with nothing in it, unlike the other tabs, which hide when the
 * payload has nothing for them. An empty Videos tab is not a dead end: it is the
 * only place the suggestion form lives, so hiding it would make the first
 * submission for a tank impossible.
 */
export function TankVideosTab({
  region,
  slug,
  tankName,
  videos,
}: {
  region: Region;
  slug: string;
  tankName: string;
  videos: TankVideoCardData[];
}) {
  // The provider merges in the reader's own queued battles, so the list and
  // the player's seek bar show the same set.
  const player = useTankVideoPlayer();
  const all = player?.videos ?? videos;
  const [view, setView] = useVideosView();
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center gap-3">
        <PanelTitle>{tankName} videos</PanelTitle>
        <span className="ml-auto flex items-center gap-3">
          {all.length > 0 && (
            <VideosViewToggle view={view} onChange={setView} />
          )}
          <SubmitVideoDialogSlot region={region} slug={slug} />
        </span>
      </PanelHeader>
      {all.length === 0 ? (
        <PanelContent>
          <p className="py-8 text-center text-sm text-fd-muted-foreground">
            No video yet for the {tankName}. Suggest one and it shows up here
            once a moderator has looked at it.
          </p>
        </PanelContent>
      ) : view === VideosView.Table ? (
        // Outside PanelContent so the table runs edge to edge, like the other
        // tabs' tables. No tank columns: every row is this page's vehicle, and
        // a play goes to the hero above rather than to another page.
        <VideosTable
          region={region}
          battles={all}
          showTank={false}
          onPlay={(battle) => player?.play(battle)}
        />
      ) : (
        <PanelContent>
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupBattlesByVideo(all).map((g) => (
              <TankVideoCard key={g.videoId} group={g} region={region} />
            ))}
          </div>
        </PanelContent>
      )}
    </Panel>
  );
}

/**
 * The two most recent videos, at the bottom of Specifications.
 *
 * The tab is the full list; this is what makes anyone find out it exists. A tank
 * page is mostly read on Specifications, and a section nobody sees collects no
 * suggestions, which is the one thing this feature needs to work.
 */
export function TankVideosPreview({
  region,
  slug,
  tankName,
  videos,
}: {
  region: Region;
  slug: string;
  tankName: string;
  videos: TankVideoCardData[];
}) {
  // Read from the provider like the tab does, so the preview picks up a video
  // approved since the shell was cached (the shell's Live wrapper revalidates
  // the list). The prop is the server render, kept as the fallback.
  const player = useTankVideoPlayer();
  const all = player?.videos ?? videos;
  if (all.length === 0) return null;
  const groups = groupBattlesByVideo(all);
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center gap-3">
        <PanelTitle>{tankName} videos</PanelTitle>
        {/* The form lives here too, not only on the tab: a video plays in the
            hero from this page as well, and the player's "suggest this moment"
            needs something to hand the moment to. */}
        <SubmitVideoDialogSlot region={region} slug={slug} />
        <Link
          href={tankDetailTabHref(
            ROUTES.TANK(region, slug),
            TankDetailTab.Videos,
          )}
          className="ml-auto text-sm text-fd-muted-foreground hover:text-fd-foreground hover:underline"
        >
          {/* Counts videos, like the cards below, not battles: the two differ
              as soon as one recording holds several. */}
          See all{groups.length > PREVIEW_VIDEO_COUNT ? ` (${groups.length})` : ""} →
        </Link>
      </PanelHeader>
      <PanelContent>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {groups.slice(0, PREVIEW_VIDEO_COUNT).map((g) => (
            <TankVideoCard key={g.videoId} group={g} region={region} />
          ))}
        </div>
      </PanelContent>
    </Panel>
  );
}

