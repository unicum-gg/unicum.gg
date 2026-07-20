"use client";

import { useSearchParams } from "next/navigation";
import { type MouseEvent, type ReactNode, useState } from "react";
import { Panel, PanelHeader } from "@/components/panel";
import {
  TANK_DETAIL_TABS,
  type TankDetailTab,
  tankDetailTabFromQuery,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { cn } from "@/lib/utils";

// Client tab bar for the tank detail page. Content for each tab is rendered on
// the server and handed in via `content`; only tabs with content show up. The
// active tab lives in the URL (`?tab=`) and is swapped client-side with
// `pushState`, so switching is instant and links/back-button still work.
export function TankDetailTabs({
  basePath,
  content,
}: {
  basePath: string;
  content: Partial<Record<TankDetailTab, ReactNode>>;
}) {
  const searchParams = useSearchParams();
  const tabs = TANK_DETAIL_TABS.filter((t) => content[t.id]);

  const urlTab = tankDetailTabFromQuery(searchParams.get("tab"));
  const [tab, setTab] = useState(urlTab);
  if (urlTab !== tab) setTab(urlTab);

  // Fall back to the first available tab if the URL points at one with no
  // content for this tank (e.g. a tank missing specs).
  const active = content[tab] ? tab : tabs[0]?.id;
  if (!active) return null;

  function selectTab(e: MouseEvent, next: TankDetailTab) {
    e.preventDefault();
    if (next === tab) return;
    setTab(next);
    window.history.pushState(null, "", tankDetailTabHref(basePath, next));
  }

  return (
    <>
      <Panel screenLines={false} className="screen-line-before">
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <nav className="flex items-center overflow-x-auto text-sm">
            {tabs.map((t) => (
              <a
                key={t.id}
                href={tankDetailTabHref(basePath, t.id)}
                onClick={(e) => selectTab(e, t.id)}
                className={cn(
                  "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
                  active === t.id
                    ? "bg-fd-secondary/40 text-fd-foreground"
                    : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
                )}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </PanelHeader>
      </Panel>
      {content[active]}
    </>
  );
}
