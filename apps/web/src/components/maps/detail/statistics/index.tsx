import type { LoadoutMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { topBattleRows } from "@/components/tanks/detail/loadouts/build-views";
import { LOADOUT_MODE_NAME_KEY } from "@/components/tanks/detail/loadouts/index";
import { getTranslation } from "@/lib/translations.server";
import { MapGroupTable } from "./group-table";
import { MapModeProvider, MapModeSwitch, ModePane } from "./mode";
import { MapOverview } from "./overview";
import { MapSampleNote } from "./sample-note";
import { mapTankRows, type MapTankRow } from "./tank-rows";
import { MapTopBattles } from "./top-battles";
import { MapVehicles } from "./vehicles";
import type { MapStatisticsModeView, MapStatisticsPayload } from "./view";

/**
 * The Statistics tab: what the battles recorded on this map say about it.
 *
 * Every mode that holds battles is rendered on the server and switched on the
 * client, the mode living in `?mode=` (see `mode.tsx`). Each heading names the
 * map AND the mode, because a figure about Onslaught read as one about Random
 * Battles is the misreading this tab is most exposed to.
 *
 * In the order a reader asks: how a battle here goes (length, ending, which
 * side wins), then who does well here (by class, by tier, by vehicle), each
 * against the same vehicles everywhere else, then the best battles fought on
 * it. The vehicles are one filterable table under every mode rather than a
 * table per mode, since its filters live in the URL.
 *
 * Only rendered for a map with recorded battles: the layout drops the tab
 * otherwise, so there is no empty state to write.
 */
export async function MapStatisticsTab({
  region,
  mapName,
  modes,
  locale,
}: {
  region: Region;
  mapName: string;
  /** Every mode with battles. */
  modes: MapStatisticsModeView[];
  locale: string;
}) {
  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/maps/detail/statistics/index", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  const held = modes.filter((view) => view.stats.battles > 0);
  if (held.length === 0) return null;

  // Opened on the mode with the most battles, where the figures are steadiest.
  // A tie keeps the switch's own order, so Random wins it.
  const initial = held.reduce((best, view) =>
    view.stats.battles > best.stats.battles ? view : best,
  ).mode;

  const named = held.map((view) => ({
    ...view,
    label: tGame(LOADOUT_MODE_NAME_KEY[view.mode]),
  }));
  const heading = (key: string, mode: string) =>
    t(key, { map: mapName, mode });

  const rowsByMode: Partial<Record<LoadoutMode, MapTankRow[]>> = {};
  const titleByMode: Partial<Record<LoadoutMode, string>> = {};
  for (const view of named) {
    rowsByMode[view.mode] = mapTankRows(view.stats.tanks);
    titleByMode[view.mode] = heading("by-vehicle", view.label);
  }

  return (
    <MapModeProvider initial={initial} modes={named.map((view) => view.mode)}>
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>{t("title", { map: mapName })}</PanelTitle>
          <MapModeSwitch
            modes={named.map((view) => ({
              mode: view.mode,
              label: view.label,
              battles: view.stats.battles,
            }))}
          />
        </PanelHeader>
        {named.map((view) => (
          <ModePane key={view.mode} mode={view.mode}>
            <PanelContent>
              <MapSampleNote
                stats={view.stats}
                modeName={view.label}
                locale={locale}
              />
            </PanelContent>
          </ModePane>
        ))}
      </Panel>

      {named.map((view) => (
        <ModePane key={view.mode} mode={view.mode}>
          <ModeHead
            stats={view.stats}
            heading={(key) => heading(key, view.label)}
            locale={locale}
            t={t}
          />
        </ModePane>
      ))}

      <PanelSeparator />
      <MapVehicles
        region={region}
        rowsByMode={rowsByMode}
        titleByMode={titleByMode}
        hint={t("by-vehicle-hint")}
      />

      {named.map((view) => {
        const topBattles = topBattleRows(view.stats);
        if (topBattles.length === 0) return null;
        return (
          <ModePane key={view.mode} mode={view.mode}>
            <PanelSeparator />
            <Panel>
              <PanelHeader>
                <PanelTitle>{heading("top-battles", view.label)}</PanelTitle>
              </PanelHeader>
              <PanelContent className="p-0">
                <p className="border-b border-fd-border px-4 py-3 text-sm text-fd-muted-foreground">
                  {t("top-battles-hint")}
                </p>
                <MapTopBattles region={region} rows={topBattles} />
              </PanelContent>
            </Panel>
          </ModePane>
        );
      })}
    </MapModeProvider>
  );
}

/** The per-battle overview and the class and tier tables, for one mode. */
function ModeHead({
  stats,
  heading,
  locale,
  t,
}: {
  stats: MapStatisticsPayload;
  /** A heading key, filled with this map and this mode. */
  heading: (key: string) => string;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslation>>["t"];
}) {
  // One set of labels for the class and tier tables, so the two read alike.
  const groupLabels = {
    records: t("col.records"),
    recordsTip: t("col.records-tip"),
    winrate: t("col.winrate"),
    damage: t("col.damage"),
    assist: t("col.assisted"),
    kills: t("col.kills"),
    spotted: t("col.spotted"),
    survival: t("col.survival"),
    xp: t("col.xp"),
    baselineTip: t("col.baseline-tip"),
  };

  return (
    <>
      <PanelSeparator />
      <MapOverview stats={stats} title={heading("overview")} locale={locale} />

      {stats.classes.length > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{heading("by-class")}</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <p className="px-4 py-3 text-sm text-fd-muted-foreground">
                {t("by-class-hint")}
              </p>
              <MapGroupTable
                kind="class"
                rows={stats.classes}
                records={stats.records}
                labels={{ ...groupLabels, group: t("col.class") }}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {stats.tiers.length > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{heading("by-tier")}</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <MapGroupTable
                kind="tier"
                rows={stats.tiers}
                records={stats.records}
                labels={{ ...groupLabels, group: t("col.tier") }}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}
    </>
  );
}
