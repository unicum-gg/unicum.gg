import {
  TankChangesFeed,
  type FeedVersion,
} from "@/components/tanks/list/changes/feed";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Shared body for /tanks/changes (EU default) and /<region>/tanks/changes: the
// global tank-rebalance feed, built forward from the moment tracking started
// (Wargaming publishes no archive of past client versions). ISR-cached like the
// other tank pages.
export async function TankChangesView({ region }: { region: Region }) {
  const { versions } = await buildSafe(
    () => unicum.region(region).tanks.changes(),
    { versions: [] as FeedVersion[] },
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            World of Tanks <span className="text-brand">changes</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Every tank characteristic Wargaming has buffed or nerfed on{" "}
            {REGION_LABEL[region]}, update by update. Tracked from the game
            client itself, so it is the real numbers, not patch-note wording.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <TankChangesFeed region={region} versions={versions} />
    </div>
  );
}
