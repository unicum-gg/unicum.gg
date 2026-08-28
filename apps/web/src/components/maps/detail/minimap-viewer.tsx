"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  BASE_CAPTURE_RADIUS_M,
  SPAWN_DIRECTION_LABEL,
  spawnDirection,
  type MapDetail,
} from "@unicum.gg/shared";
import { MinimapImage } from "@/components/maps/minimap-image";
import { MinimapLayers } from "@/components/maps/detail/minimap-layers";
import { axisCells, MinimapGrid } from "@/components/maps/detail/minimap-grid";
import {
  BASE,
  CONTROL_POINT,
  Overlay,
  POI_RECON,
  POI_STRIKE,
  spawnUrl,
  type ViewGeometry,
} from "@/components/maps/detail/minimap-overlay";

/** The side a team starts from on this view, e.g. "South". Null when the mode
 * declares neither spawns nor bases, where the legend just names the team. */
function teamSide(view: ViewGeometry, team: 1 | 2): string | null {
  const direction = spawnDirection(view, team);
  return direction ? SPAWN_DIRECTION_LABEL[direction] : null;
}

/** View key of the Onslaught play area, the one view that is not a random
 * battle. Exported because the gallery links straight to it (`?view=`), so both
 * ends of that contract read the same constant. */
export const ONSLAUGHT_VIEW = "onslaught";

// A selectable minimap view: one battle-context (a random mode, or Onslaught)
// with its own minimap image + play-area bounds on top of the shared geometry.
type MapView = ViewGeometry & {
  key: string;
  label: string;
  minimapUrl: string;
  widthMeters: number;
  heightMeters: number;
};

function buildViews(detail: MapDetail): MapView[] {
  const views: MapView[] = detail.geometry.map((g) => ({
    key: g.mode,
    label: g.label,
    minimapUrl: detail.minimapUrl,
    widthMeters: detail.widthMeters,
    heightMeters: detail.heightMeters,
    bases: g.bases,
    spawns: g.spawns,
    controlPoint: g.controlPoint,
    pois: [],
  }));
  if (detail.onslaught) {
    views.push({
      key: ONSLAUGHT_VIEW,
      label: "Onslaught",
      minimapUrl: detail.onslaught.minimapUrl,
      widthMeters: detail.onslaught.widthMeters,
      heightMeters: detail.onslaught.heightMeters,
      bases: { team1: [], team2: [] },
      spawns: detail.onslaught.spawns,
      controlPoint: detail.onslaught.controlPoint,
      pois: detail.onslaught.pointsOfInterest,
    });
  }
  return views;
}

export function MinimapViewer({
  detail,
  onActiveViewChange,
}: {
  detail: MapDetail;
  /** Reports the selected view's key (mode or "onslaught") so the page can sync
   * its stats sidebar to the active battle context. */
  onActiveViewChange?: (key: string) => void;
}) {
  const views = buildViews(detail);
  const [viewIndex, setViewIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  // Random events are not a mode: they may fire during a random battle,
  // whichever one is being played, so they overlay the selected view rather than
  // replacing it. `showAfter` picks which half to draw, the danger area the game
  // marks beforehand or the ground it leaves behind.
  const [showEvents, setShowEvents] = useState(false);
  const [showAfter, setShowAfter] = useState(false);
  // A handful of maps draw only the aftermath, with no danger area marked, so
  // there is no before to switch back to: the layer opens on the aftermath and
  // the toggle stays hidden.
  const hasZones = detail.randomEvents.some((e) => e.zoneUrls.length > 0);
  const afterOnly = showAfter || !hasZones;
  const view = views[viewIndex];

  // The selected view lives in the URL (?view=onslaught) so a view is
  // shareable/bookmarkable and a link from the Onslaught gallery tab lands
  // straight on it. The first view (index 0) is the default and stays out of the
  // URL. Read via window.location to keep the page statically prerenderable.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration from the URL on mount */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("view");
    if (key) {
      const idx = views.findIndex((v) => v.key === key);
      if (idx > 0) setViewIndex(idx);
    }
    // `?events=zones` / `?events=after` so a map can be linked with the layer
    // already on, which is the state worth sharing ("look at it after").
    const events = params.get("events");
    if (events === "zones" || events === "after") {
      setShowEvents(true);
      setShowAfter(events === "after");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const skipViewWriteback = useRef(true);
  useEffect(() => {
    if (skipViewWriteback.current) {
      skipViewWriteback.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const key = views[viewIndex]?.key;
    if (key && viewIndex > 0) params.set("view", key);
    else params.delete("view");
    // Only when the layer is actually drawn, and naming the half actually drawn:
    // the URL describes what is on screen. A map with no events, or the
    // Onslaught view, draws none, and a map with no zone art opens on the
    // aftermath whatever `showAfter` says.
    const drawn =
      showEvents && key !== ONSLAUGHT_VIEW && detail.randomEvents.length > 0;
    if (drawn) params.set("events", showAfter || !hasZones ? "after" : "zones");
    else params.delete("events");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- views is stable per map
  }, [viewIndex, showEvents, showAfter]);

  const activeKey = view?.key;
  useEffect(() => {
    if (activeKey) onActiveViewChange?.(activeKey);
  }, [activeKey, onActiveViewChange]);
  const width = view?.widthMeters ?? detail.widthMeters;
  const height = view?.heightMeters ?? detail.heightMeters;
  // The 100 m capture circle as a percentage of the play area's own metres, so
  // it scales 1:1 with the minimap on every view (Onslaught's is reduced).
  const diameter = 2 * BASE_CAPTURE_RADIUS_M;
  const capX = (diameter / width) * 100;
  const capY = (diameter / height) * 100;
  const maxDim = Math.max(width, height);
  const gridCols = axisCells(width, maxDim);
  const gridRows = axisCells(height, maxDim);
  // Event/arcade maps have no arena_def dimensions, so a metric grid can't be
  // drawn (the cell counts would be NaN); hide the toggle entirely for them.
  const hasGrid = width > 0 && height > 0;
  const hasBases =
    (view?.bases.team1.length ?? 0) + (view?.bases.team2.length ?? 0) > 0;
  const hasStrike = view?.pois.some((p) => p.type !== 2) ?? false;
  const hasRecon = view?.pois.some((p) => p.type === 2) ?? false;
  // Onslaught is played on its own reduced area and runs no events, so the
  // toggle only exists on the random-battle views.
  const canShowEvents =
    detail.randomEvents.length > 0 && view?.key !== ONSLAUGHT_VIEW;
  const eventsOn = canShowEvents && showEvents;
  // Only the events that actually draw something in the half on screen, so the
  // legend below names what is drawn rather than every event on the map.
  const drawnEvents = eventsOn
    ? detail.randomEvents.filter(
        (e) => (afterOnly ? e.afterUrls : e.zoneUrls).length > 0,
      )
    : [];
  const eventLayers = drawnEvents.flatMap((e) =>
    afterOnly ? e.afterUrls : e.zoneUrls,
  );
  const pill =
    "rounded-full border border-fd-border px-3 py-1 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground data-[active=true]:border-brand data-[active=true]:bg-brand/10 data-[active=true]:text-brand";

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
        {views.length > 1 &&
          views.map((v, i) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setViewIndex(i)}
              data-active={i === viewIndex}
              className={pill}
            >
              {v.label}
            </button>
          ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canShowEvents && (
            <button
              type="button"
              onClick={() => setShowEvents((s) => !s)}
              data-active={eventsOn}
              className={pill}
            >
              Random events
            </button>
          )}
          {eventsOn && hasZones && (
            <button
              type="button"
              onClick={() => setShowAfter((s) => !s)}
              data-active={showAfter}
              className={pill}
            >
              After the event
            </button>
          )}
          {hasGrid && (
            <button
              type="button"
              onClick={() => setShowGrid((s) => !s)}
              data-active={showGrid}
              className={pill}
            >
              Grid
            </button>
          )}
        </div>
      </div>

      <div className="relative aspect-square w-full overflow-hidden border-y border-fd-border bg-fd-muted">
        <MinimapImage
          key={view?.minimapUrl ?? detail.minimapUrl}
          src={view?.minimapUrl ?? detail.minimapUrl}
          arenaId={detail.arenaId}
          alt={`${detail.name} minimap`}
          sizes="(max-width: 1024px) 100vw, 640px"
          priority
        />
        {eventLayers.length > 0 && (
          <MinimapLayers urls={eventLayers} />
        )}
        {showGrid && hasGrid && <MinimapGrid cols={gridCols} rows={gridRows} />}
        {view && (
          <Overlay
            geometry={view}
            capX={capX}
            capY={capY}
            mapWidth={width}
            mapHeight={height}
          />
        )}
      </div>

      {view && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-sm text-fd-muted-foreground">
          {hasBases && (
            <span className="flex items-center gap-2">
              <Image src={BASE.team1} alt="" width={28} height={28} />
              <Image src={BASE.team2} alt="" width={28} height={28} />
              Base
            </span>
          )}
          {/* Named per team, with the side each starts from. "Team 1" is the
              game's own numbering and means nothing on its own: a player knows
              they spawned at the bottom of the minimap, not that they were
              team 1. The side is read off the geometry already drawn above, so
              the legend cannot disagree with the markers. */}
          <span className="flex items-center gap-2">
            <Image src={spawnUrl("team1", 0)} alt="" width={26} height={26} />
            Team 1{teamSide(view, 1) ? ` · ${teamSide(view, 1)}` : ""}
          </span>
          <span className="flex items-center gap-2">
            <Image src={spawnUrl("team2", 0)} alt="" width={26} height={26} />
            Team 2{teamSide(view, 2) ? ` · ${teamSide(view, 2)}` : ""}
          </span>
          {view.controlPoint && (
            <span className="flex items-center gap-2">
              <Image src={CONTROL_POINT} alt="" width={28} height={28} />
              Control point
            </span>
          )}
          {hasStrike && (
            <span className="flex items-center gap-2">
              <Image src={POI_STRIKE} alt="" width={28} height={28} />
              Strike
            </span>
          )}
          {hasRecon && (
            <span className="flex items-center gap-2">
              <Image src={POI_RECON} alt="" width={28} height={28} />
              Recon
            </span>
          )}
          {eventsOn && (
            <span className="flex items-center gap-2">
              {!afterOnly && (
                <span
                  aria-hidden
                  className="size-3.5 rounded-xs bg-[#e8955a]"
                />
              )}
              {afterOnly ? "After: " : "Danger zone: "}
              {drawnEvents.map((e) => e.name).join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
