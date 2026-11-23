"use client";

import { SUPPORTER_TIER_MONTHS, SupporterTier } from "@unicum.gg/shared";
import { Crest } from "@/components/entity/badges/crest";
import { SUPPORTER_TIER_CREST } from "@/components/entity/badges/supporter-tier";
import { useTranslation } from "@/hooks/use-translation";

const TIERS = [
  SupporterTier.Base,
  SupporterTier.Bronze,
  SupporterTier.Silver,
  SupporterTier.Gold,
] as const;

/**
 * The four supporter crests side by side, each with what it takes: the reason
 * to pledge monthly rather than give once, since only a pledge held over time
 * moves the crest. Read off the same thresholds the crests themselves use.
 */
export function SupporterTiersLegend() {
  const { t } = useTranslation("components/support/tiers-legend");
  return (
    <div className="space-y-2">
      <p className="text-sm text-fd-muted-foreground">{t("intro")}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {TIERS.map((tier) => (
          <li key={tier} className="flex items-center gap-1.5 text-xs">
            <Crest kind={SUPPORTER_TIER_CREST[tier]} size={20} />
            <span>
              {tier === SupporterTier.Base
                ? t("from-the-start")
                : t("after-months", { count: SUPPORTER_TIER_MONTHS[tier] })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
