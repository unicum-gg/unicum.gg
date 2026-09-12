"use client";

import Link from "@/components/link";
import { Panel, PanelHeader } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { StrongholdTier } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";

function tabClass(active: boolean): string {
  return cn(
    "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
    active
      ? "bg-fd-secondary/40 text-fd-foreground"
      : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
  );
}

// The "Overall" tab points back to the clan rating leaderboard (/clans). Leave
// `activeTier` undefined there so Overall is highlighted, or pass the tier on a
// stronghold page. The tier enum values double as the URL path segments.
export function StrongholdTierTabs({
  region,
  activeTier,
}: {
  region: Region;
  activeTier?: StrongholdTier;
}) {
  const { t } = useTranslation(
    "components/clans/list/stronghold/tier-tabs",
  );
  const { t: tGame } = useTranslation("game/vocabulary");
  return (
    <Panel>
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <nav className="flex items-center overflow-x-auto text-sm">
          <Link
            href={ROUTES.CLANS(region)}
            className={tabClass(activeTier === undefined)}
          >
            {t("overall")}
          </Link>
          {(Object.values(StrongholdTier) as StrongholdTier[]).map((tier) => (
            <Link
              key={tier}
              href={ROUTES.STRONGHOLD(region, tier)}
              className={tabClass(tier === activeTier)}
            >
              {tGame(`stronghold-tiers.${tier}`)}
            </Link>
          ))}
        </nav>
      </PanelHeader>
    </Panel>
  );
}
