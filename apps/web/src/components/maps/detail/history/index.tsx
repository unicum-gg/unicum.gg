import { Fragment } from "react";
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
  hasVersionMinimap,
  VersionMinimap,
} from "@/components/maps/detail/history/version-map";
import {
  MAP_HISTORY_TRACKING_START,
  BATTLE_TYPE_LABEL,
  BattleType,
  MAP_AREA_MAP,
  MAP_AREA_ONSLAUGHT,
  MAP_VARIANT_PREFIX,
  mapChangeArea,
  type MapChangeArea,
  type MapDetail,
} from "@unicum.gg/shared";

/** The map's own rows first, then its Onslaught area, then the variants, so a
 * version reads from the ground everyone plays outwards. */
function areaRank(area: MapChangeArea): number {
  if (area === MAP_AREA_MAP) return 0;
  if (area === MAP_AREA_ONSLAUGHT) return 1;
  return 2;
}

/** What to call an area above its rows. A variant area carries its battle type,
 * so it names itself. */
function areaLabel(area: MapChangeArea): string {
  if (area === MAP_AREA_ONSLAUGHT) {
    return BATTLE_TYPE_LABEL[BattleType.Onslaught];
  }
  const battleType = area.slice(MAP_VARIANT_PREFIX.length);
  return battleType in BATTLE_TYPE_LABEL
    ? BATTLE_TYPE_LABEL[battleType as BattleType]
    : battleType;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** One version's worth of recorded changes, as the API serves it. */
export type MapHistoryVersion = {
  gameVersion: string;
  capturedAt: string | Date;
  changes: { field: string; previous: string | null; next: string | null }[];
};

/** The minimap's own column, divided from the changes by the same rule the rest
 * of the site uses between a subject and its rows. Empty (and rule-less) when
 * the area has nothing to draw. */
function MinimapColumn({
  detail,
  changes,
  area,
}: {
  detail: MapDetail;
  changes: FormattedMapChange[];
  area: MapChangeArea;
}) {
  if (!hasVersionMinimap(detail, changes, area)) return null;
  return (
    <div className="border-t border-fd-border sm:border-t-0 sm:border-l">
      <VersionMinimap detail={detail} changes={changes} area={area} />
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
function VersionChanges({
  detail,
  changes,
}: {
  detail: MapDetail;
  changes: FormattedMapChange[];
}) {
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
              {areaLabel(area)}
            </div>
          ) : null}
          <div className="grid sm:grid-cols-[minmax(0,1fr)_16rem]">
            <ul className="divide-y divide-fd-border">
              {rows.map((change) => (
                <ChangeRow key={change.field} change={change} />
              ))}
            </ul>
            <MinimapColumn detail={detail} changes={rows} area={area} />
          </div>
        </div>
      ))}
    </>
  );
}

function ChangeRow({ change }: { change: FormattedMapChange }) {
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
export function MapChangesHistory({
  detail,
  versions,
  testVersion,
  testChanges,
  addedVersion,
  addedAt,
  removedVersion,
  removedAt,
  present,
}: {
  detail: MapDetail;
  versions: MapHistoryVersion[];
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
}) {
  const sections = versions
    .map((version) => ({
      version,
      changes: version.changes.map((c) =>
        formatMapChange(c.field, c.previous, c.next),
      ),
    }))
    .filter((s) => s.changes.length > 0);

  const pending = testChanges.map((c) =>
    formatMapChange(c.field, c.previous, c.next, true),
  );

  return (
    <>
      <Panel>
        {/* The header is this panel's only content, so its closing rule would
            land on the panel's own and draw the line twice. */}
        <PanelHeader screenLines={false}>
          <PanelTitle>{detail.name} changes</PanelTitle>
          <p className="mt-1 text-sm text-fd-muted-foreground">
            Every update that changed this map, newest first, read from the game
            client itself.
          </p>
        </PanelHeader>
      </Panel>
      <PanelSeparator />

      {pending.length > 0 ? (
        <Panel className="border border-brand/40" screenLines={false}>
          <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <PanelTitle as="h3" className="text-base">
              <span className="text-brand">Common Test</span>
              {testVersion ? (
                <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                  {testVersion}
                </span>
              ) : null}
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="p-0">
            <p className="px-4 py-3 text-xs text-fd-muted-foreground">
              Not released. Wargaming can still change or drop any of this before
              the update ships.
            </p>
            <div className="border-t border-fd-border">
              <VersionChanges detail={detail} changes={pending} />
            </div>
          </PanelContent>
        </Panel>
      ) : null}
      {pending.length > 0 ? <PanelSeparator /> : null}
      {sections.map(({ version, changes }, i) => (
        <Fragment key={version.gameVersion}>
          {i > 0 ? <PanelSeparator /> : null}
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle as="h3" className="text-base">
                Update {version.gameVersion}
                <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                  {dateFmt.format(new Date(version.capturedAt))}
                </span>
              </PanelTitle>
              <span className="text-xs text-fd-muted-foreground tabular-nums">
                {changes.length} {changes.length === 1 ? "change" : "changes"}
              </span>
            </PanelHeader>
            <PanelContent className="p-0">
              <VersionChanges detail={detail} changes={changes} />
            </PanelContent>
          </Panel>
        </Fragment>
      ))}

      {sections.length > 0 || pending.length > 0 ? <PanelSeparator /> : null}
      <Panel>
        <PanelHeader>
          <PanelTitle as="h3" className="text-base">In the game</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <ul className="divide-y divide-fd-border">
            {addedVersion ? (
              <LifecycleRow label="Added" version={addedVersion} at={addedAt} />
            ) : (
              // Already in the client when tracking started: the real date is
              // unknown, so all we can say is that it came before.
              <LifecycleRow
                label="Added"
                version={MAP_HISTORY_TRACKING_START.version}
                at={null}
                before
              />
            )}
            {!present && removedVersion ? (
              <LifecycleRow
                label="Removed"
                version={removedVersion}
                at={removedAt}
              />
            ) : null}
          </ul>
        </PanelContent>
      </Panel>
    </>
  );
}

function LifecycleRow({
  label,
  version,
  at,
  before = false,
}: {
  label: string;
  version: string;
  at: string | Date | null;
  before?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-fd-muted-foreground">{label}</span>
      <span className="font-medium">
        {before ? "Before update " : "Update "}
        {version}
        {at ? (
          <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
            {dateFmt.format(new Date(at))}
          </span>
        ) : null}
      </span>
    </li>
  );
}
