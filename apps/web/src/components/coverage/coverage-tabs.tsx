import Link from "@/components/link";
import { Panel, PanelHeader, PanelSeparator } from "@/components/panel";
import { TabBar, tabItemClass } from "@/components/ui/tab-bar";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";
import type { Region } from "@unicum.gg/wargaming";

export enum CoverageTab {
  /** What we track and how fresh it is: the page as it always was. */
  Data = "data",
  /** Who uses the site, the mod and the bot. */
  Usage = "usage",
}

const HREF: Record<CoverageTab, (region: Region) => string> = {
  [CoverageTab.Data]: ROUTES.COVERAGE,
  [CoverageTab.Usage]: ROUTES.COVERAGE_USAGE,
};

/**
 * The coverage page's two tabs. Each is a route of its own and renders this
 * bar itself, told which one it is, so the pages need no shared layout: the two
 * share nothing else.
 */
export async function CoverageTabs({
  region,
  locale,
  active,
}: {
  region: Region;
  locale: string;
  active: CoverageTab;
}) {
  const { t } = await getTranslation(
    "components/coverage/coverage-tabs",
    locale,
  );
  return (
    // Framed by a separator on each side, like every other panel of the page,
    // so the bar reads as its own band between the hero and the content.
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <TabBar>
            {Object.values(CoverageTab).map((tab) => (
              <Link
                key={tab}
                href={HREF[tab](region)}
                prefetch="intent"
                className={tabItemClass(tab === active)}
              >
                {t(tab)}
              </Link>
            ))}
          </TabBar>
        </PanelHeader>
      </Panel>
      <PanelSeparator />
    </>
  );
}
