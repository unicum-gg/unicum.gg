import {
  type FeedMap,
  MapBlock,
} from "@/components/maps/list/changes/map-block";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import type { Region } from "@unicum.gg/wargaming";

/**
 * What the Common Test build currently running is about to change about the
 * game's maps, above the shipped feed.
 *
 * Its own panel rather than another version in the feed, because it is not one:
 * the rest of the page is what Wargaming shipped and cannot be taken back, this
 * is a build that can still be re-cut or dropped before the update lands.
 *
 * Not paginated, and shown whole: a test touches a handful of maps, and it is
 * the part of the page a reader comes back for while a test is running.
 */
export function PendingMapChanges({
  region,
  version,
  maps,
}: {
  region: Region;
  /** The test build the changes were read from, null when none runs. */
  version: string | null;
  maps: FeedMap[];
}) {
  if (maps.length === 0) return null;

  return (
    <Panel className="border border-brand/40" screenLines={false}>
      <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <PanelTitle as="h2" className="text-base">
          <span className="text-brand">Common Test</span>
          {version ? (
            <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
              {version}
            </span>
          ) : null}
        </PanelTitle>
        <span className="text-xs text-fd-muted-foreground tabular-nums">
          {maps.length} map{maps.length === 1 ? "" : "s"}
        </span>
      </PanelHeader>
      <PanelContent className="p-0">
        <p className="px-4 py-3 text-xs text-fd-muted-foreground">
          Not released. Wargaming can still change or drop any of this before the
          update ships.
        </p>
        <div className="divide-y divide-fd-border border-t border-fd-border">
          {maps.map((map) => (
            <MapBlock key={map.arenaId} region={region} map={map} />
          ))}
        </div>
      </PanelContent>
    </Panel>
  );
}
