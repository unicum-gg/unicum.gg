"use client";

import Link from "@/components/link";
import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";
import { useSelectedLayoutSegment } from "next/navigation";
import { Panel, PanelHeader } from "@/components/panel";
import {
  MAP_DETAIL_TABS,
  type MapDetailTab,
  mapDetailTabHref,
} from "@/components/maps/detail/tabs";
import { TabBar, tabItemClass } from "@/components/ui/tab-bar";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The tab bar of a map page. Each tab is a route of its own, so this renders the
 * nav alone and the segment below it renders that tab's content.
 *
 * It reads the active tab from the router rather than taking it as a prop: it is
 * rendered by the layout, which is shared by every tab and therefore never told
 * which one is showing. `available` lists the tabs that have something to show
 * for this map.
 *
 * Deliberately the vehicle bar's twin rather than a reuse of it. The two differ
 * in exactly the thing that would have to become a prop (the tab enum, the href
 * builder, the label namespace), and the one piece of behaviour the vehicle bar
 * carries that this one must not is the `?battle=` it threads through every
 * link to keep its hero player going.
 *
 * The counts follow the profile's rule rather than the vehicle bar's, which has
 * none: a tab says how much is behind it, and a tab with nothing behind it says
 * nothing at all. Printing "(0)" on every map until the first contribution
 * lands would be a column of zeroes across fifty pages, which is exactly what
 * the profile omits its tournament count for.
 */
export function MapDetailTabs({
  basePath,
  available,
  counts,
}: {
  basePath: string;
  available: MapDetailTab[];
  /** How much each tab holds. A tab absent from this map, or present with
   * nothing in it, is labelled without a number. */
  counts: Partial<Record<MapDetailTab, number>>;
}) {
  const { locale } = useLocale();
  const { t: tLabel } = useTranslation("components/maps/detail/tab-bar");
  // Null on the index route, which is Tactics.
  const segment = useSelectedLayoutSegment();
  const active =
    MAP_DETAIL_TABS.find((t) => t.segment === segment)?.id ?? available[0];

  const tabs = MAP_DETAIL_TABS.filter((t) => available.includes(t.id));
  if (tabs.length === 0) return null;

  return (
    // No rule of its own, at either edge. The panel above closes with one and
    // the tab's own content opens with one, so a `screen-line-before` here
    // would land on the first at the same pixel and read as a 2px border. The
    // vehicle page gets away with carrying one because a 32px hatched
    // separator sits between its hero and its bar, which is exactly the height
    // this page was tabbed to stop spending.
    <Panel screenLines={false}>
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <TabBar>
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={mapDetailTabHref(basePath, t.id)}
              // A tab bar is a row of whole pages. Nothing in this tree draws a
              // loading boundary, so each one Next prefetched on sight would be
              // the destination in full. See `prefetch` in `@/components/link`.
              prefetch="intent"
              className={tabItemClass(active === t.id)}
            >
              {counts[t.id]
                ? tLabel("tab-count", {
                    tab: tLabel(`tabs.${t.id}`),
                    count: numberFormat(locale).format(counts[t.id]!),
                  })
                : tLabel(`tabs.${t.id}`)}
            </Link>
          ))}
        </TabBar>
      </PanelHeader>
    </Panel>
  );
}
