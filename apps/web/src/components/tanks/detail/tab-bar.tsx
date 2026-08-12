"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Panel, PanelHeader } from "@/components/panel";
import {
  TANK_DETAIL_TABS,
  type TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { BATTLE_PARAM } from "@/components/tanks/detail/videos/battle-param";
import { useTankVideoPlayer } from "@/components/tanks/detail/videos/player";
import { cn } from "@/lib/utils";

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
        <nav className="flex items-center overflow-x-auto text-sm">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`${tankDetailTabHref(basePath, t.id)}${battle}`}
              className={cn(
                "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
                active === t.id
                  ? "bg-fd-secondary/40 text-fd-foreground"
                  : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </PanelHeader>
    </Panel>
  );
}
