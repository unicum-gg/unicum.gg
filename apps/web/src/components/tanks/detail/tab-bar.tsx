"use client";

import Link from "@/components/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Panel, PanelHeader } from "@/components/panel";
import {
  TANK_DETAIL_TABS,
  type TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { BATTLE_PARAM } from "@/components/tanks/detail/videos/battle-param";
import { useTankVideoPlayer } from "@/components/tanks/detail/videos/player";
import { TabNav, tabClass } from "@/components/tab-nav";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The tab bar of a tank page. Each tab is a route of its own, so this renders
 * the nav alone and the segment below it renders that tab's content.
 *
 * It reads the active tab from the router rather than taking it as a prop: it
 * is rendered by the layout, which is shared by all four tabs and therefore
 * never told which one is showing. `available` lists the tabs that have
 * something to show for this tank.
 */
export function TankDetailTabs({
  basePath,
  available,
}: {
  basePath: string;
  available: TankDetailTab[];
}) {
  const { t: tLabel } = useTranslation("components/tanks/detail/tab-bar");
  // Null on the index route, which is Specifications.
  const segment = useSelectedLayoutSegment();
  const active =
    TANK_DETAIL_TABS.find((t) => t.segment === segment)?.id ?? available[0];

  // A battle playing in the hero survives a tab change, so the link carries it:
  // the URL has to keep saying what is on screen, or a copied link opens a page
  // that plays nothing.
  const playing = useTankVideoPlayer()?.current;
  const battle = playing ? `?${BATTLE_PARAM}=${playing.id}` : "";

  const tabs = TANK_DETAIL_TABS.filter((t) => available.includes(t.id));
  if (tabs.length === 0) return null;

  return (
    <Panel screenLines={false} className="screen-line-before">
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <TabNav>
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`${tankDetailTabHref(basePath, t.id)}${battle}`}
              className={tabClass(active === t.id)}
            >
              {tLabel(`tabs.${t.id}`)}
            </Link>
          ))}
        </TabNav>
      </PanelHeader>
    </Panel>
  );
}
