"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerTankDetailPanel } from "@/components/players/detail/tanks/detail-panel";
import { PlayerTanksTable } from "@/components/players/detail/tanks/table";
import { RateYourTanksPrompt } from "@/components/players/detail/tanks/rate-prompt";
import { TableSkeleton } from "@/components/table-skeleton";
import { TANKS_SKELETON_COLUMNS } from "@/components/players/detail/tanks/skeleton-columns";
import type {
  PlayerTankRecord,
  PlayerTankRow,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Its own section (not part of Overall) so the ~700-row table isn't
// server-rendered on the default page load, which was the dominant SSR cost.
// The rows load from a separate endpoint on demand when the tab is opened; a
// `?section=tanks` deep-link seeds them from the server render for SEO.
export function TanksTab({
  region,
  nickname,
  vehicles,
  loading,
  tankDetail,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
  loading: boolean;
  /** The vehicle record open beside the table, when the URL names one. Server
   * rendered, so it is in the HTML a crawler and the `.md` twin read. */
  tankDetail?: PlayerTankRecord | null;
}) {
  return (
    <>
      <PanelSeparator />
      {/* Two panes on a wide screen, the way the game's own Service Record
          reads: the list on the left, the selected vehicle on the right. They
          stack below `xl`, record first, since a reader who just picked a tank
          is looking for it rather than for the list they came from. */}
      <div className="flex flex-col-reverse gap-0 xl:flex-row xl:items-start">
        <Panel className="min-w-0 flex-1">
          {/* `screenLines={false}` + a real border: the site's screen line is
              200vw wide, so beside the record it ran across the panel too. */}
          <PanelHeader screenLines={false} className="border-b border-fd-border">
            <PanelTitle>
              {nickname}&apos;s tanks
              {loading ? "" : ` (${intFmt.format(vehicles.length)})`}
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="p-0">
            {/* Only ever drawn on the reader's own garage, and only for tanks
              they have the battles for and have not judged yet. It renders
              nothing otherwise, so it costs a signed-out visitor a null. */}
            {loading ? null : (
              <RateYourTanksPrompt
                region={region}
                nickname={nickname}
                vehicles={vehicles}
              />
            )}
            {loading ? (
              <TableSkeleton columns={TANKS_SKELETON_COLUMNS} rows={12} />
            ) : (
              <PlayerTanksTable
                region={region}
                nickname={nickname}
                vehicles={vehicles}
                selectedSlug={tankDetail?.slug ?? null}
              />
            )}
          </PanelContent>
        </Panel>

        {/* Two wrappers, each doing one job. The outer stretches to the
            table's full height and carries both edges, the separator and the
            page's right border, so they run down to the end of the list rather
            than stopping under the last line of the record. The inner is the
            sticky one, so picking a tank near the bottom of 157 rows does not
            leave its record scrolled off the top; it carries the sticky rather
            than the Panel, whose `screen-line-*` sets its own
            `position: relative` and would win over the utility. */}
        {tankDetail ? (
          <div className="w-full shrink-0 xl:w-[30rem] xl:self-stretch xl:border-x xl:border-fd-border">
            {/* As tall as what is left of the screen under the 56px header, so
                the record reads as a side pane rather than a card floating over
                dead space. Sticky clamps it to the wrapper, so it stops with
                the list instead of running past it. */}
            <div className="xl:sticky xl:top-14 xl:h-[calc(100vh-3.5rem)]">
              <Panel
                screenLines={false}
                className="h-full border-l-0 xl:border-r-0"
              >
                <PlayerTankDetailPanel
                  region={region}
                  detail={tankDetail}
                  ratingHistory={tankDetail.ratingHistory}
                  awards={tankDetail.awards}
                />
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
