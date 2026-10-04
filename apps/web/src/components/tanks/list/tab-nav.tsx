"use client";

import Link from "@/components/link";
import { useRouter } from "@/hooks/use-router";
import { useTranslation } from "@/hooks/use-translation";
import type { MouseEvent } from "react";
import { PanelHeader } from "@/components/panel";
import { TabBar, tabItemClass } from "@/components/ui/tab-bar";
import { TANK_TABS, type TankTab, tankTabHref } from "./tabs";

/**
 * The tank index's tab bar.
 *
 * Its own component because the tabs are no longer all the same kind of page:
 * five are views of the tank table, Videos is a list of what the community has
 * linked, and both need the same bar above them.
 *
 * Each tab is a real route, so these are real links: that is what keeps the
 * title, description and canonical in step with the page. The click handler
 * only shortcuts the navigation to preserve the query string, which carries the
 * filters, and it steps aside for modified clicks so opening in a new tab still
 * works.
 */
export function TanksTabNav({
  active,
  basePath,
}: {
  active: TankTab;
  basePath: string;
}) {
  const router = useRouter();
  const { t } = useTranslation("components/tanks/list/tabs");

  function selectTab(e: MouseEvent, next: TankTab) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (next === active) return;
    const search = window.location.search;
    router.push(`${tankTabHref(basePath, next)}${search}`);
  }

  return (
    <PanelHeader className="px-0! py-0!">
      <TabBar>
        {TANK_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tankTabHref(basePath, tab.id)}
            // A tab bar is a row of whole pages. Nothing in this tree draws a
            // loading boundary, so each one Next prefetched on sight was the
            // destination in full: measured on the tanks index, 1.8 MB of them.
            // See `prefetch` in `@/components/link`.
            prefetch="intent"
            onClick={(e) => selectTab(e, tab.id)}
            className={tabItemClass(active === tab.id)}
          >
            {t(tab.id)}
          </Link>
        ))}
      </TabBar>
    </PanelHeader>
  );
}
