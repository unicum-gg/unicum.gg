"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import type { Icon } from "@phosphor-icons/react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
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
import { MapDetailTabs } from "@/components/maps/detail/tab-bar";
import type { MapDetailTab } from "@/components/maps/detail/tabs";
import ROUTES from "@/constants/routes";
import {
  BattleType,
  TEAM_SIZE_BATTLE_TYPES,
  type MapDetail,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";
import { battleTypeName, mapName } from "@/components/game-name";

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

/**
 * Everything a map page keeps while you move around it: the name, the minimap
 * and the tab bar under them.
 *
 * It lives in the segment's layout rather than in each tab, which is what makes
 * the selected view survive a tab change. Next only re-renders the segment below
 * a shared layout, so the minimap keeps its mode pills, its variant and its
 * overlays while the panel underneath is replaced. Rendered per tab, the same
 * markup would reset an Onslaught layout back to Standard on every navigation.
 *
 * It is also why the tabs hold no geometry of their own: a tactic has to be read
 * under the ground it was fought on, which is the rule the videos panel was
 * written against ("under the minimap, never over it"), and a tab bar that moved
 * the map off screen would have broken it.
 */
export function MapShell({
  detail: rawDetail,
  region,
  available,
  counts,
  children,
}: {
  detail: MapDetail;
  region: Region;
  /** The tabs this map has something to show for. */
  available: MapDetailTab[];
  /** How much each of them holds, for the number beside its name. */
  counts: Partial<Record<MapDetailTab, number>>;
  /**
   * The active tab, rendered by the server and handed down.
   *
   * A slot rather than components imported here, because this file is a client
   * component and the tabs are async server components: the stars, the
   * histograms, the tactics and the change rows belong in the HTML, which is
   * what a crawler and the `.md` twin read, and only the controls inside them
   * need the browser.
   */
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/maps/detail/view");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tMaps } = useTranslation("game/maps");
  // Named once, here, and handed down: the minimap, the history panel and the
  // videos panel all read `detail.name`, so localizing the object rather than
  // the heading translates the whole page in one place. The name is Wargaming's
  // own, in the language the reader plays in. The description arrives already
  // resolved, from the server (see the page).
  const detail = useMemo(
    () => ({
      ...rawDetail,
      name: mapName(rawDetail.arenaId, rawDetail.name, tMaps),
    }),
    [rawDetail, tMaps],
  );
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
    ? battleTypeName(BattleType.Onslaught, tGame)
    : variant
      ? battleTypeName(variant.battleType, tGame)
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
    t("camouflage", {
      camouflage: tGame(`map-camouflage.${detail.camouflage}`),
    }),
    hasSize ? `${detail.widthMeters} × ${detail.heightMeters} m` : null,
    events.length > 0
      ? t("n-random-events", { count: events.length })
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
                      label={t("size")}
                      value={
                        <>
                          {width} × {height} m{" "}
                          <span className="text-sm font-normal text-fd-muted-foreground">
                            ({numberFormat(locale).format(width * height)} m²)
                          </span>
                        </>
                      }
                    />
                  )}
                  {hasTime && (
                    <Stat
                      icon={ClockIcon}
                      label={t("battle-time")}
                      value={roundClock(detail.roundLength)}
                    />
                  )}
                  {hasTeam && (
                    <Stat
                      icon={UsersIcon}
                      label={t("team-size")}
                      value={`${teamSize} v ${teamSize}`}
                    />
                  )}
                  {hasModes && (
                    <Stat icon={CompassIcon} label={t("mode")} value={modesValue} />
                  )}
                  {showEvents && (
                    <Stat
                      icon={WarningIcon}
                      label={t("random-events")}
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

      {/* The bar, then the tab below it. Everything above stays put whichever
          tab is open: a tactic has to be read under the ground it was fought
          on, and the view selected in the minimap (an Onslaught layout, a
          Waffenträger variant) survives the navigation because Next only
          replaces the segment under a shared layout. */}
      <MapDetailTabs
        basePath={ROUTES.MAP(region, detail.slug)}
        available={available}
        counts={counts}
      />

      {children}
    </div>
  );
}
