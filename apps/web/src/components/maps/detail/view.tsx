"use client";

import type { Icon } from "@phosphor-icons/react";
import { Fragment, type ReactNode, useState } from "react";
import {
  ArrowsOutCardinalIcon,
  ClockIcon,
  CompassIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import { MapActionsMenu } from "@/components/maps/detail/actions-menu";
import { CAMO_META } from "@/components/maps/meta";
import { MinimapViewer } from "@/components/maps/detail/minimap-viewer";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { TEAM_SIZE_BATTLE_TYPES, type MapDetail } from "@unicum.gg/shared";
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

export function MapView({
  detail,
  region,
}: {
  detail: MapDetail;
  region: Region;
}) {
  const camo = CAMO_META[detail.camouflage];
  const CamoIcon = camo.icon;
  const modeNames = detail.geometry.map((g) => g.label).join(", ");

  // The stats sidebar follows the minimap's selected view: Onslaught runs on a
  // reduced play area and is always 7v7, so those stats swap when it is picked.
  const [activeKey, setActiveKey] = useState<string>(
    detail.geometry[0]?.mode ?? (detail.onslaught ? "onslaught" : ""),
  );
  const onslaught =
    activeKey === "onslaught" ? detail.onslaught : null;
  const width = onslaught?.widthMeters ?? detail.widthMeters;
  const height = onslaught?.heightMeters ?? detail.heightMeters;
  const teamSize = onslaught ? 7 : detail.maxPlayersInTeam;
  // The "Mode" stat follows the selected view (like Size/Team size): it names the
  // one mode currently overlaid, not the full list (which the view pills above
  // the minimap already show).
  const activeGeo = detail.geometry.find((g) => g.mode === activeKey);
  const modesValue = onslaught ? "Onslaught" : (activeGeo?.label ?? "-");

  // Event/arcade maps have no arena_def geometry, so their play area, timer,
  // team size and modes are unknown: show only the stats we actually have.
  const hasSize = width > 0;
  const hasTime = detail.roundLength > 0;
  // Onslaught always overrides to a real 7v7; otherwise only assert a team size
  // for even-sided PvP modes (never for a defaulted 15 on a PvE/event map).
  const hasTeam =
    teamSize > 0 &&
    (Boolean(onslaught) ||
      detail.battleTypes.some((bt) => TEAM_SIZE_BATTLE_TYPES.has(bt)));
  const hasModes = Boolean(onslaught) || modeNames.length > 0;
  const hasAnyStat = hasSize || hasTime || hasTeam || hasModes;
  const metaParts = [
    `${camo.label} camouflage`,
    hasSize ? `${detail.widthMeters} × ${detail.heightMeters} m` : null,
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
    </div>
  );
}
