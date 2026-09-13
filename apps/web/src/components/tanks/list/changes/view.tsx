import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import {
  TankChangesFeed,
  type FeedVersion,
} from "@/components/tanks/list/changes/feed";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Shared body for /tanks/changes (EU default) and /<region>/tanks/changes: the
// global tank-rebalance feed, built forward from the moment tracking started
// (Wargaming publishes no archive of past client versions). ISR-cached like the
// other tank pages.
export async function TankChangesView({
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
  const { t } = await getTranslation("components/tanks/list/changes/view", locale);
  const { versions } = await buildSafe(
    () => unicum.region(region).tanks.changes(),
    { versions: [] as FeedVersion[] },
  );
  // The feed paginates over the flat (version, tank) list, so that is what
  // bounds its pages rather than the number of updates.
  const pagedRows = versions.reduce((n, version) => n + version.tanks.length, 0);
  assertPageInRange(page, pagedRows, PAGINATION.SIZE.FEED);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Read by Bing rather than by Google, which dropped them in 2019: the
          crawlable links in the pager are what carries the chain. */}
      <PaginationRelLinks
        path={ROUTES.TANKS_CHANGES(region)}
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
                changes: <span className="text-brand">{t("changes")}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("every-tank-characteristic-wargaming-has", { region: REGION_LABEL[region] })}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <TankChangesFeed region={region} versions={versions} page={page} />
    </div>
  );
}
