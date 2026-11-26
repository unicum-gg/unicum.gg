import { dateFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { Fragment } from "react";
import {
  ChangesDiscordBanner,
  ChangesFeed,
} from "@/components/discord/changes-banner";
import { MapOverlayPicture, type MapOverlayLayer } from "./overlay-picture";
import { MinimapRedrawnRow } from "./redrawn-row";
import { mapName } from "@/components/game-name";
import { GlossaryLabel } from "@/components/glossary/label";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  formatMapChange,
  type FormattedMapChange,
} from "@/components/maps/change-format";
import {
  areaLabel,
  areaRank,
} from "@/components/maps/detail/history/areas";
import { MapLifecyclePanel } from "./lifecycle-panel";
import {
  compareGameVersions,
  hasVersionMinimap,
  minimapEras,
  type VersionMinimapImage,
} from "@/components/maps/detail/history/plan";
import { VersionMinimap } from "@/components/maps/detail/history/version-map";
import {
  MapChangeKind,
  MAP_AREA_MAP,
  mapChangeArea,
  type MapChangeArea,
  type MapDetail,
  COMMON_TEST_ANCHOR,
  updateAnchor,
} from "@unicum.gg/shared";

const DATE_PATTERN = "d MMM yyyy";

/** One version's worth of recorded changes, as the API serves it. */
export type MapHistoryVersion = {
  gameVersion: string;
  capturedAt: string | Date;
  changes: { field: string; previous: string | null; next: string | null }[];
};

/** The minimap's own column, divided from the changes by the same rule the rest
 * of the site uses between a subject and its rows: the moved markers, and the
 * ground and objects the update reworked, each its own picture. Empty (and
 * rule-less) when the area has nothing to draw. */
function MinimapColumn({
  detail,
  changes,
  area,
  context,
  title,
  minimap,
}: {
  detail: MapDetail;
  changes: FormattedMapChange[];
  area: MapChangeArea;
  context?: string;
  title: string;
  minimap?: VersionMinimapImage;
}) {
  const markers = hasVersionMinimap(detail, changes, area);
  const layers = overlayLayers(changes);
  if (!markers && layers.length === 0) return null;
  return (
    <div className="divide-y divide-fd-border border-t border-fd-border sm:border-t-0 sm:border-l">
      {markers ? (
        <VersionMinimap
          detail={detail}
          changes={changes}
          area={area}
          context={context}
          minimap={area === MAP_AREA_MAP ? minimap : undefined}
        />
      ) : null}
      {layers.map((layer) => (
        <MapOverlayPicture key={layer.id} shown={layer} title={title} subtitle={context} />
      ))}
    </div>
  );
}

/**
 * The changes of one version, split by the play area they happened on, and each
 * half rendered against its own minimap.
 *
 * Onslaught is a different map: a reduced area, its own minimap image, its own
 * scale. An update that moved a base on the full map and a spawn in Onslaught
 * used to draw both sets of markers over the same image, which put the Onslaught
 * ones somewhere they never were. Each area now gets its own rows and its own
 * map, and the Onslaught half is labelled, since it is the one a reader would
 * otherwise take for the map they know.
 */
async function VersionChanges({
  detail,
  changes,
  context,
  minimap,
  locale,
}: {
  detail: MapDetail;
  changes: FormattedMapChange[];
  /** Which update (or test build) these rows are, for the enlarged minimap's
   * heading: the dialog covers the panel that says so. */
  context?: string;
  /** The minimap this version was played on (see `minimapEras`). */
  minimap?: VersionMinimapImage;
  locale: string;
}) {
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const { t: tMaps } = await getTranslation("game/maps", locale);
  const title = mapName(detail.arenaId, detail.name, tMaps);
  // The areas a version actually touched, in the order the rows come in: the map
  // first (its own changes are keyed without a prefix), then its Onslaught area,
  // then one per variant. Derived rather than listed, so a new kind of variant
  // needs nothing here.
  const areas: { area: MapChangeArea; rows: FormattedMapChange[] }[] = [];
  for (const change of changes) {
    const area = mapChangeArea(change.field);
    const section = areas.find((s) => s.area === area);
    if (section) section.rows.push(change);
    else areas.push({ area, rows: [change] });
  }
  areas.sort((a, b) => areaRank(a.area) - areaRank(b.area));

  return (
    <>
      {areas.map(({ area, rows }, i) => (
        <div key={area} className={i > 0 ? "border-t border-fd-border" : undefined}>
          {areas.length > 1 && area !== MAP_AREA_MAP ? (
            <div className="border-b border-fd-border px-4 py-2 text-xs uppercase tracking-wide text-fd-muted-foreground">
              {areaLabel(area, tGame)}
            </div>
          ) : null}
          <div className="grid sm:grid-cols-[minmax(0,1fr)_16rem]">
            <ul className="divide-y divide-fd-border">
              {[...rows]
                .sort((a, b) => overlayRank(a) - overlayRank(b))
                .map((change) => (
                  <ChangeRow
                    key={change.field}
                    change={change}
                    title={title}
                    subtitle={context}
                  />
                ))}
            </ul>
            <MinimapColumn
              detail={detail}
              changes={rows}
              area={area}
              context={context}
              title={title}
              minimap={minimap}
            />
          </div>
        </div>
      ))}
    </>
  );
}

/** The terrain leads, then the objects, then everything else: a reshaped hill
 * changes how a map plays, where most of the objects an update moves are rocks
 * and fences. */
const overlayRank = (change: FormattedMapChange) =>
  change.kind === MapChangeKind.Relief ? 0 : change.kind === MapChangeKind.Objects ? 1 : 2;

/** The rows drawn over the minimap, one picture each. */
function overlayLayers(rows: FormattedMapChange[]): MapOverlayLayer[] {
  return [...rows].sort((a, b) => overlayRank(a) - overlayRank(b)).flatMap((change) =>
    change.overlay?.layer
      ? [
          {
            id: change.field,
            label: change.label,
            summary: change.summary,
            base: change.overlay.base,
            layer: change.overlay.layer,
            legend: change.overlay.legend,
          },
        ]
      : [],
  );
}

function ChangeRow({
  change,
  title,
  subtitle,
}: {
  change: FormattedMapChange;
  title: string;
  subtitle?: string;
}) {
  if (change.images)
    return (
      <MinimapRedrawnRow
        label={change.label}
        summary={change.summary}
        images={change.images}
        title={title}
        subtitle={subtitle}
      />
    );
  return (
    <li className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-fd-muted-foreground">
        <GlossaryLabel>{change.label}</GlossaryLabel>
      </span>
      <span className="text-right font-medium tabular-nums">
        {change.before && change.after ? (
          <>
            <span className="text-fd-muted-foreground">{change.before}</span>
            <span className="mx-1.5 text-fd-muted-foreground">→</span>
            {change.after}
          </>
        ) : (
          change.summary
        )}
      </span>
    </li>
  );
}

/**
 * Everything a map has been through, update by update, newest first.
 *
 * Nothing here is a buff or a nerf: a wider play area or a spawn moved 200 m is
 * a change in how the map plays, not an improvement, so unlike a tank's history
 * this one is not coloured. What it does instead is draw the moves, since a
 * marker's position is the whole content of the change.
 *
 * The history is reconstructed from the game client's own arena definitions back
 * to the first update our mirror covers, so a map already in the game then is
 * only known to predate it.
 */
export async function MapChangesHistory({
  detail,
  versions,
  testVersion,
  testChanges,
  addedVersion,
  addedAt,
  removedVersion,
  removedAt,
  present,
  legacyMinimaps,
  locale,
}: {
  detail: MapDetail;
  versions: MapHistoryVersion[];
  /** The minimaps the archived full clients drew, oldest first. */
  legacyMinimaps?: { version: string; through: string; url: string }[];
  /** The Common Test build `testChanges` was read from, null when none runs. */
  testVersion: string | null;
  /** What the running test is about to change about this map. Not history: it
   * has not shipped, and can still be re-cut or dropped. */
  testChanges: { field: string; previous: string | null; next: string | null }[];
  addedVersion: string | null;
  addedAt: string | Date | null;
  removedVersion: string | null;
  removedAt: string | Date | null;
  present: boolean;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/history/index",
    locale,
  );
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const { t: tChange } = await getTranslation(
    "components/maps/change-format",
    locale,
  );
  const date = (pattern: string) => dateFormat(locale, pattern);
  const wording = { t: tChange, tGame };
  const sections = versions
    .map((version) => ({
      version,
      changes: version.changes.map((c) =>
        formatMapChange(c.field, c.previous, c.next, false, wording, locale),
      ),
    }))
    .filter((s) => s.changes.length > 0);

  // The version the map entered in is asked for too, whether or not it holds a
  // section of its own, so the panel below can show the map as it arrived.
  const eraVersions = sections.map(({ version, changes }) => ({
    gameVersion: version.gameVersion,
    changes,
  }));
  if (addedVersion && !eraVersions.some((v) => v.gameVersion === addedVersion)) {
    eraVersions.push({ gameVersion: addedVersion, changes: [] });
    eraVersions.sort((a, b) => compareGameVersions(b.gameVersion, a.gameVersion));
  }
  const eras = minimapEras(eraVersions, legacyMinimaps);
  // The map as it entered the game: the minimap of that version, or for a map
  // already there when tracking began, the oldest archived one. Nothing when
  // that image is not known, since today's would answer a different question.
  const arrival = addedVersion ? eras.get(addedVersion) : undefined;
  const arrivalImage = addedVersion
    ? arrival && !arrival.latest && !arrival.nearest
      ? { src: arrival.src ?? detail.minimapUrl, label: addedVersion }
      : null
    : legacyMinimaps?.[0]
      ? { src: legacyMinimaps[0].url, label: legacyMinimaps[0].version }
      : null;

  const pending = testChanges.map((c) =>
    formatMapChange(c.field, c.previous, c.next, true, wording, locale),
  );

  return (
    <>
      <Panel>
        {/* The header is this panel's only content, so its closing rule would
            land on the panel's own and draw the line twice. */}
        <PanelHeader screenLines={false}>
          <PanelTitle>{t("title", { map: detail.name })}</PanelTitle>
          <p className="mt-1 text-sm text-fd-muted-foreground">
            {t("every-update-that-changed-this")}</p>
        </PanelHeader>
      </Panel>
      <PanelSeparator />

      {pending.length > 0 ? (
        <Panel
          id={COMMON_TEST_ANCHOR}
          className="scroll-mt-24 border border-brand/40"
          screenLines={false}
        >
          <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <PanelTitle as="h3" className="text-base">
              <span className="text-brand">{tGame("features.common-test")}</span>
              {testVersion ? (
                <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                  {testVersion}
                </span>
              ) : null}
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="p-0">
            <p className="px-4 py-3 text-xs text-fd-muted-foreground">
              {t("not-released-wargaming-can-still")}</p>
            <div className="border-t border-fd-border">
              <VersionChanges
                detail={detail}
                changes={pending}
                locale={locale}
                context={[tGame("features.common-test"), testVersion]
                  .filter((part) => part)
                  .join(" ")}
              />
            </div>
          </PanelContent>
        </Panel>
      ) : null}
      {pending.length > 0 ? <PanelSeparator /> : null}
      {sections.map(({ version, changes }, i) => (
        <Fragment key={version.gameVersion}>
          {i > 0 ? <PanelSeparator /> : null}
          <Panel id={updateAnchor(version.gameVersion)} className="scroll-mt-24">
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle as="h3" className="text-base">
                {t("update", { version: version.gameVersion })}
                <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                  {date(DATE_PATTERN).format(new Date(version.capturedAt))}
                </span>
              </PanelTitle>
              <span className="text-xs text-fd-muted-foreground tabular-nums">
                {t("n-changes", {
                  count: changes.length,
                })}
              </span>
            </PanelHeader>
            <PanelContent className="p-0">
              <VersionChanges
                detail={detail}
                changes={changes}
                locale={locale}
                context={t("update", { version: version.gameVersion })}
                minimap={eras.get(version.gameVersion)}
              />
            </PanelContent>
          </Panel>
        </Fragment>
      ))}

      {sections.length > 0 || pending.length > 0 ? <PanelSeparator /> : null}
      <MapLifecyclePanel
        detail={detail}
        addedVersion={addedVersion}
        addedAt={addedAt}
        removedVersion={removedVersion}
        removedAt={removedAt}
        present={present}
        arrivalImage={arrivalImage}
        locale={locale}
      />
      <PanelSeparator />
      <Panel>
        <ChangesDiscordBanner feed={ChangesFeed.Maps} locale={locale} />
      </Panel>
    </>
  );
}
