"use client";

import Link from "@/components/link";
import { Panel, PanelHeader } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { StrongholdTier } from "@unicum.gg/shared";
import { TabBar, tabItemClass } from "@/components/ui/tab-bar";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";

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
        <TabBar>
          {/* A tab bar is a row of whole pages, and with no loading boundary in
            this tree Next prefetched each one in full on sight. See `prefetch`
            in `@/components/link`. */}
          <Link
            href={ROUTES.CLANS(region)}
            prefetch="intent"
            className={tabItemClass(activeTier === undefined)}
          >
            {t("overall")}
          </Link>
          {(Object.values(StrongholdTier) as StrongholdTier[]).map((tier) => (
            <Link
              key={tier}
              href={ROUTES.STRONGHOLD(region, tier)}
              prefetch="intent"
              className={tabItemClass(tier === activeTier)}
            >
              {tGame(`stronghold-tiers.${tier}`)}
            </Link>
          ))}
        </TabBar>
      </PanelHeader>
    </Panel>
  );
}
