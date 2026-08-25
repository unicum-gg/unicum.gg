import {
  MapChangesFeed,
  type MapFeedVersion,
} from "@/components/maps/list/changes/feed";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Shared body for /maps/changes (EU default) and /<region>/maps/changes: what
// every update changed about the game's maps, reconstructed from the client's
// own arena definitions. ISR-cached like the other map pages.
export async function MapChangesView({ region }: { region: Region }) {
  const { versions } = await buildSafe(
    () => unicum.region(region).maps.changes(),
    { versions: [] as MapFeedVersion[] },
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            World of Tanks <span className="text-brand">map changes</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Every map Wargaming has reworked, update by update: play areas
            resized, bases and spawns moved, modes gained and lost, maps added
            and pulled. Read from the game client itself, so it covers what the
            patch notes leave out.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <MapChangesFeed region={region} versions={versions} />
    </div>
  );
}
