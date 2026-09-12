import type { Metadata } from "next";
import { StrongholdLeaderboardPage } from "@/components/clans/list/stronghold";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import {
  STRONGHOLD_MIN_BATTLES,
  StrongholdPeriod,
  StrongholdTier,
} from "@unicum.gg/shared";

function parseTier(tier: string): StrongholdTier {
  return (Object.values(StrongholdTier) as string[]).includes(tier)
    ? (tier as StrongholdTier)
    : StrongholdTier.T10;
}

// ISR: prerendered per tier at the canonical view (default sort SR + Overall
// period). Sort/period swap client-side via the SDK (see the view), so nothing
// here reads searchParams or the cookie — which is what let this go static and
// makes the tier tabs navigate onto cached HTML.
export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  return (Object.values(StrongholdTier) as StrongholdTier[]).map((tier) => ({
    tier,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tier: string }>;
}): Promise<Metadata> {
  const { locale, tier } = await params;
  const { t } = await getTranslation("app/clans/stronghold/page", locale);
  // The tier's own name, in the reader's language. `STRONGHOLD_TIER_LABEL` is
  // the English source and the key side; `game/vocabulary` is what a French
  // reader's title has to say, and a page whose body reads "Incursions" must
  // not be titled "Advances".
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const label = REGION_LABEL[Region.EU];
  const tierEnum = parseTier(tier);
  const tierLabel = tGame(`stronghold-tiers.${tierEnum}`);
  return constructMetadata({
    locale,
    title: t("title", { tier: tierLabel, region: label }),
    description: t("description", {
      region: label,
      tier: tierLabel,
      battles: STRONGHOLD_MIN_BATTLES[tierEnum][StrongholdPeriod.Overall],
    }),
    canonical: ROUTES.STRONGHOLD(Region.EU, tierEnum),
  });
}

export default async function EuStrongholdPage({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const { tier } = await params;
  return <StrongholdLeaderboardPage region={Region.EU} tierParam={tier} />;
}
