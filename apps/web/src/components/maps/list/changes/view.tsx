import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import {
  MapChangesFeed,
  type MapFeedVersion,
} from "@/components/maps/list/changes/feed";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import type { FeedMap } from "@/components/maps/list/changes/map-block";
import { PendingMapChanges } from "@/components/maps/list/changes/pending";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Shared body for /maps/changes (EU default) and /<region>/maps/changes: what
// every update changed about the game's maps, reconstructed from the client's
// own arena definitions, plus what the running Common Test is about to change.
// ISR-cached like the other map pages.
export async function MapChangesView({
  region,
  locale,
  page,
}: {
  region: Region;
  locale: string;
  /**
   * The page to render, from the `/page/[n]` route the proxy sends `?page=` to.
   * Server-rendered rather than swapped in after hydration: a crawler reads the
   * HTML and leaves.
   */
  page?: number;
}) {
  const { t } = await getTranslation("components/maps/list/changes/view", locale);
  const { versions, testVersion, testMaps } = await buildSafe(
    () => unicum.region(region).maps.changes(),
    {
      versions: [] as MapFeedVersion[],
      testVersion: null as string | null,
      testMaps: [] as FeedMap[],
    },
  );
  // Paginated over the flat (version, map) list, like the tank feed beside it.
  const pagedRows = versions.reduce((n, version) => n + version.maps.length, 0);
  assertPageInRange(page, pagedRows, PAGINATION.SIZE.FEED);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Read by Bing rather than by Google, which dropped them in 2019: the
          crawlable links in the pager are what carries the chain. */}
      <PaginationRelLinks
        path={ROUTES.MAPS_CHANGES(region)}
        page={page}
        total={pagedRows}
        size={PAGINATION.SIZE.FEED}
        locale={locale}
      />
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("title")}
              values={{
                changes: (
                  <span className="text-brand">{t("map-changes")}</span>
                ),
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("every-map-wargaming-has-reworked")}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {testMaps.length > 0 ? (
        <>
          <PendingMapChanges locale={locale}
            region={region}
            version={testVersion}
            maps={testMaps}
          />
          <PanelSeparator />
        </>
      ) : null}

      <MapChangesFeed region={region} versions={versions} page={page} />
    </div>
  );
}
