"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { PanelHeader } from "@/components/panel";
import { cn } from "@/lib/utils";
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

  function selectTab(e: MouseEvent, next: TankTab) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (next === active) return;
    const search = window.location.search;
    router.push(`${tankTabHref(basePath, next)}${search}`);
  }

  return (
    <PanelHeader className="px-0! py-0!">
      <nav className="flex items-center overflow-x-auto text-sm">
        {TANK_TABS.map((t) => (
          <Link
            key={t.id}
            href={tankTabHref(basePath, t.id)}
            onClick={(e) => selectTab(e, t.id)}
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
  );
}
