"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { PLAYER_TABS, PlayerTab, playerTabHref } from "./tabs";

export function PlayerTabsNav({
  basePath,
  activeTab,
  onSelect,
}: {
  basePath: string;
  activeTab: PlayerTab;
  onSelect: (tab: PlayerTab) => void;
}) {
  // Real anchors keep the tabs deep-linkable and let modifier/middle clicks
  // open a new tab natively. A plain left click is intercepted so the switch
  // happens client-side (state + pushState) with no server RSC round-trip.
  function handleClick(event: MouseEvent<HTMLAnchorElement>, tab: PlayerTab) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onSelect(tab);
  }

  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {PLAYER_TABS.map((t) => (
        <a
          key={t.id}
          href={playerTabHref(basePath, t.id)}
          onClick={(event) => handleClick(event, t.id)}
          className={cn(
            "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
            activeTab === t.id
              ? "bg-fd-secondary/40 text-fd-foreground"
              : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
