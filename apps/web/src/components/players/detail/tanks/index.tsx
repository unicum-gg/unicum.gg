"use client";

import { useFormat } from "@/hooks/use-format";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { useTranslation } from "@/hooks/use-translation";
import { PlayerTankDetailPanel } from "@/components/players/detail/tanks/detail-panel";
import { PlayerTanksTable } from "@/components/players/detail/tanks/table";
import { RateYourTanksPrompt } from "@/components/players/detail/tanks/rate-prompt";
import { TableSkeleton } from "@/components/table-skeleton";
import { TankModeSelect } from "@/components/players/detail/tanks/mode-select";
import { TANKS_SKELETON_COLUMNS } from "@/components/players/detail/tanks/skeleton-columns";
import { DEFAULT_TANK_BATTLE_MODE } from "@unicum.gg/shared";
import type {
  PlayerTankRecord,
  PlayerTankRow,
  TankBattleMode,
  TankModeAvailability,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

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
  tankLoadout,
  modes = [],
  mode = DEFAULT_TANK_BATTLE_MODE,
  rowsMode = DEFAULT_TANK_BATTLE_MODE,
  onSelectMode,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
  loading: boolean;
  /** The vehicle record open beside the table, when the URL names one. Server
   * rendered, so it is in the HTML a crawler and the `.md` twin read. */
  tankDetail?: PlayerTankRecord | null;
  /** The loadout panel for the open vehicle, rendered on the SERVER and
   * passed down: it names equipment and crew perks out of catalogues that
   * never cross the wire (`SERVER_ONLY_NAMESPACES`), so it cannot be built
   * inside this client tree. Null when we hold no loadout for the pair. */
  tankLoadout?: React.ReactNode;
  /** The battle modes this garage has a record in, for the selector. Fewer than
   * two draws nothing, which is the usual case. */
  modes?: TankModeAvailability[];
  /** The mode the SELECT shows, which follows the reader's click at once.
   * Random Battles unless another is picked; there is no overall view, see
   * `DEFAULT_TANK_BATTLE_MODE`. */
  mode?: TankBattleMode;
  /** The mode the ROWS are in, which lags `mode` for the length of a fetch.
   * Everything that labels the rows reads this one. */
  rowsMode?: TankBattleMode;
  onSelectMode?: (next: TankBattleMode) => void;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/detail/tanks/index");
  return (
    <>
      <PanelSeparator />
      {/* Two panes on a wide screen, the way the game's own Service Record
          reads: the list on the left, the selected vehicle on the right. They
          stack below `xl`, record first, since a reader who just picked a tank
          is looking for it rather than for the list they came from. */}
      {/* At least a screen tall, and both columns filling it. The record is
          a screen high by design, while the list is only as tall as its rows:
          filter the table down to one tank and the record overflowed a
          wrapper shorter than itself, so the list's own bottom border cut
          straight across it. A floor on the row, and stretch rather than
          start, keeps the two columns ending on the same line whichever of
          them is the longer. */}
      <div className="flex flex-col-reverse gap-0 xl:min-h-[calc(100vh-3.5rem)] xl:flex-row xl:items-stretch">
        <Panel className="min-w-0 flex-1">
          {/* `screenLines={false}` + a real border: the site's screen line is
              200vw wide, so beside the record it ran across the panel too. */}
          {/* Title left, mode right, the way the record panel's own header
              reads. `flex-wrap` rather than a breakpoint, so the select drops
              under the title only when the two genuinely stop fitting.

              `min-h-14` is shared with the record's own header beside it, and
              it is a MINIMUM so a wrapped select can still grow. The two sit
              side by side from `xl` up and their rules have to line up, which
              on the content alone they do not: a title's line box is 28px and
              this select is 32, so adding it here lifted this header above the
              one across from it. Stated on both rather than left to the
              tallest child, which is what let one control drift them apart.

              `py-2.5` is what makes the minimum actually bind HERE: the
              header's own `py-3` plus a 32px select plus the rule is 57, one
              past the 56 it is held to, and a minimum a child already exceeds
              buys nothing. Tightened so the tallest control fits inside the
              shared height rather than setting it. */}
          <PanelHeader
            screenLines={false}
            className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-fd-border py-2.5"
          >
            <PanelTitle className="min-w-0">
              {loading
                ? t("title", { nickname })
                : t("title-count", {
                    nickname,
                    count: num(INT_FORMAT).format(vehicles.length),
                  })}
            </PanelTitle>
            {/* Across from the count, which is the number it changes: picking a
                mode narrows the list to the vehicles the player took into it. */}
            {onSelectMode ? (
              <TankModeSelect
                options={modes}
                active={mode}
                onSelect={onSelectMode}
                className="shrink-0"
              />
            ) : null}
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
              <TableSkeleton rail columns={TANKS_SKELETON_COLUMNS} rows={12} />
            ) : (
              <PlayerTanksTable
                region={region}
                nickname={nickname}
                vehicles={vehicles}
                selectedSlug={tankDetail?.slug ?? null}
                mode={rowsMode}
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
                  loadout={tankLoadout}
                  modes={tankDetail.modes}
                />
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
