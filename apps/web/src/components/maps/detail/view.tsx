"use client";

import type { Icon } from "@phosphor-icons/react";
import { Fragment, type ReactNode, useState } from "react";
import {
  ArrowsOutCardinalIcon,
  ClockIcon,
  CompassIcon,
  UsersIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { MapActionsMenu } from "@/components/maps/detail/actions-menu";
import { MapCommonTestBadge } from "@/components/maps/common-test-badge";
import { CAMO_META } from "@/components/maps/meta";
import { MinimapViewer } from "@/components/maps/detail/minimap-viewer";
import {
  ONSLAUGHT_VIEW,
  variantForKey,
  variantViewKey,
} from "@/components/maps/detail/views";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { MapVideosPanel } from "@/components/maps/detail/videos";
import {
  MapChangesHistory,
  type MapHistoryVersion,
} from "@/components/maps/detail/history";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  BATTLE_TYPE_LABEL,
  BattleType,
  TEAM_SIZE_BATTLE_TYPES,
  type MapDetail,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

function roundClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: Icon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 shrink-0 text-fd-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          {label}
        </span>
        <span className="font-medium text-fd-foreground">{value}</span>
      </div>
    </div>
  );
}

/** What the history endpoint returns, as the page hands it down. Null when the
 * endpoint could not be read at render time. */
export type MapHistoryData = {
  versions: MapHistoryVersion[];
  addedVersion: string | null;
  addedAt: string | Date | null;
  removedVersion: string | null;
  removedAt: string | Date | null;
  present: boolean;
  tracked: boolean;
  testVersion: string | null;
  testChanges: { field: string; previous: string | null; next: string | null }[];
} | null;

export function MapView({
  detail,
  region,
  videos,
  history,
}: {
  detail: MapDetail;
  region: Region;
  /** Rendered by the server, so the tactics are in the HTML rather than
   * fetched once the browser has caught up. */
  videos: TankVideoCardData[];
  history: MapHistoryData;
}) {
  const camo = CAMO_META[detail.camouflage];
  const CamoIcon = camo.icon;
  const modeNames = detail.geometry.map((g) => g.label).join(", ");

  // The stats sidebar follows the minimap's selected view: Onslaught runs on a
  // reduced play area and is always 7v7, so those stats swap when it is picked.
  // The first view the minimap opens on: the first random mode, else the map's
  // own Onslaught layout, else its first variant (a map that is only played
  // somewhere else, like a Story Mode chapter).
  const [activeKey, setActiveKey] = useState<string>(
    detail.geometry[0]?.mode ??
      (detail.onslaught
        ? ONSLAUGHT_VIEW
        : detail.variants[0]
          ? variantViewKey(detail.variants[0].battleType)
          : ""),
  );
  // Onslaught runs on a reduced area and is always 7v7, wherever it is played:
  // on the map's own arena or on a variant's.
  const variant = variantForKey(detail, activeKey);
  const onslaught =
    activeKey === ONSLAUGHT_VIEW ? detail.onslaught : (variant?.onslaught ?? null);
  // A variant is its own arena, so its play area is its own too.
  const width = onslaught?.widthMeters ?? variant?.widthMeters ?? detail.widthMeters;
  const height =
    onslaught?.heightMeters ?? variant?.heightMeters ?? detail.heightMeters;
  const teamSize = onslaught ? 7 : detail.maxPlayersInTeam;
  // The "Mode" stat follows the selected view (like Size/Team size): it names the
  // one mode currently overlaid, not the full list (which the view pills above
  // the minimap already show).
  const activeGeo = detail.geometry.find((g) => g.mode === activeKey);
  const modesValue = onslaught
    ? BATTLE_TYPE_LABEL[BattleType.Onslaught]
    : variant
      ? BATTLE_TYPE_LABEL[variant.battleType]
      : (activeGeo?.label ?? "-");

  // Event/arcade maps have no arena_def geometry, so their play area, timer,
  // team size and modes are unknown: show only the stats we actually have.
  const hasSize = width > 0;
  const hasTime = detail.roundLength > 0;
  // Onslaught always overrides to a real 7v7; otherwise only assert a team size
  // for even-sided PvP modes (never for a defaulted 15 on a PvE/event map).
  // A view's team size is only meaningful for the battle type it is played as:
  // the Waffenträger and Last Stand variants are event modes with their own
  // structure, so the map's 15v15 says nothing about them.
  const hasTeam =
    teamSize > 0 &&
    (Boolean(onslaught) ||
      (variant
        ? TEAM_SIZE_BATTLE_TYPES.has(variant.battleType)
        : detail.battleTypes.some((bt) => TEAM_SIZE_BATTLE_TYPES.has(bt))));
  const hasModes = Boolean(onslaught) || modeNames.length > 0;
  // Events do not fire in Onslaught, which is played on its own reduced area, so
  // the line goes away with the rest of the view-synced stats when it is picked.
  const events = detail.randomEvents;
  const showEvents = events.length > 0 && !onslaught;
  const hasAnyStat = hasSize || hasTime || hasTeam || hasModes || showEvents;
  const metaParts = [
    `${camo.label} camouflage`,
    hasSize ? `${detail.widthMeters} × ${detail.heightMeters} m` : null,
    events.length > 0
      ? `${events.length} random event${events.length > 1 ? "s" : ""}`
      : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="p-0">
          <header className="flex flex-col">
            <div className="flex min-w-0 items-center gap-3 px-4 py-3">
              <span className={camo.className}>
                <CamoIcon weight="fill" className="size-7 shrink-0" />
              </span>
              <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight sm:text-4xl">
                {detail.name}
              </h1>
              {/* The whole map is on the test client alone, not just a layout of
                * it, so the crest belongs beside its name. */}
              {detail.commonTest && <MapCommonTestBadge size={18} />}
              <MapActionsMenu
                region={region}
                slug={detail.slug}
                name={detail.name}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-fd-border px-4 py-2 text-xs text-fd-muted-foreground">
              {metaParts.map((part, i) => (
                <Fragment key={part}>
                  {i > 0 && <span className="text-fd-border">·</span>}
                  <span>{part}</span>
                </Fragment>
              ))}
            </div>
          </header>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="p-0">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
            <MinimapViewer detail={detail} onActiveViewChange={setActiveKey} />

            <aside className="flex flex-col divide-y divide-fd-border border-t border-fd-border lg:border-t-0 lg:border-l">
              {hasAnyStat && (
                <div className="flex flex-col gap-4 p-4">
                  {hasSize && (
                    <Stat
                      icon={ArrowsOutCardinalIcon}
                      label="Size"
                      value={
                        <>
                          {width} × {height} m{" "}
                          <span className="text-sm font-normal text-fd-muted-foreground">
                            ({(width * height).toLocaleString("en-US")} m²)
                          </span>
                        </>
                      }
                    />
                  )}
                  {hasTime && (
                    <Stat
                      icon={ClockIcon}
                      label="Battle time"
                      value={roundClock(detail.roundLength)}
                    />
                  )}
                  {hasTeam && (
                    <Stat
                      icon={UsersIcon}
                      label="Team size"
                      value={`${teamSize} v ${teamSize}`}
                    />
                  )}
                  {hasModes && (
                    <Stat icon={CompassIcon} label="Mode" value={modesValue} />
                  )}
                  {showEvents && (
                    <Stat
                      icon={WarningIcon}
                      label="Random events"
                      value={events.map((e) => e.name).join(", ")}
                    />
                  )}
                </div>
              )}

              {detail.description && (
                <div className="p-4">
                  <p className="text-sm leading-relaxed text-fd-muted-foreground">
                    {detail.description}
                  </p>
                </div>
              )}
            </aside>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Under the minimap, never over it: the geometry above is what makes a
          tactic readable, and the video explains it rather than replacing it. */}
      <MapVideosPanel region={region} map={detail} initialVideos={videos} />

      {history?.tracked ? (
        <>
          <PanelSeparator />
          <MapChangesHistory
            detail={detail}
            versions={history.versions}
            testVersion={history.testVersion}
            testChanges={history.testChanges}
            addedVersion={history.addedVersion}
            addedAt={history.addedAt}
            removedVersion={history.removedVersion}
            removedAt={history.removedAt}
            present={history.present}
          />
        </>
      ) : null}
    </div>
  );
}
