import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StrongholdLeaderboardPage } from "@/components/clans/list/stronghold";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, REGION_LABEL, REGIONS } from "@unicum.gg/wargaming";
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

// ISR like the rest of the clan boards: prerendered per (region, tier) at the
// canonical view (default sort SR + Overall period), so the tier tabs navigate
// onto cached HTML instead of a per-request dynamic render. Sort/period are
// swapped client-side via the SDK (no navigation, see the view), and deep links
// (`?sort=`/`?period=`) are re-applied on mount, so nothing here reads
// searchParams or the cookie — which is what let this go static.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the other boards (data materialized hourly)

export function generateStaticParams() {
  return REGIONS.flatMap((region) =>
    (Object.values(StrongholdTier) as StrongholdTier[]).map((tier) => ({
      region,
      tier,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; tier: string }>;
}): Promise<Metadata> {
  const { locale, region, tier } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  const tierEnum = parseTier(tier);
  const { t } = await getTranslation("app/clans/stronghold/page", locale);
  // The tier's own name, in the reader's language. `STRONGHOLD_TIER_LABEL` is
  // the English source and the key side; `game/vocabulary` is what a French
  // reader's title has to say, and a page whose body reads "Incursions" must
  // not be titled "Advances".
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const tierLabel = tGame(`stronghold-tiers.${tierEnum}`);
  return constructMetadata({
    locale,
    title: t("title", { tier: tierLabel, region: label }),
    description: t("description", {
      region: label,
      tier: tierLabel,
      // The overall floor, which is the board this URL opens on. Indexing the
      // tier alone yields the record of all four periods, and the template
      // literal this used to sit in stringified it as "[object Object]".
      battles: STRONGHOLD_MIN_BATTLES[tierEnum][StrongholdPeriod.Overall],
    }),
    canonical: ROUTES.STRONGHOLD(region, tierEnum),
  });
}

export default async function RegionStrongholdPage({
  params,
}: {
  params: Promise<{ region: string; tier: string }>;
}) {
  const { region, tier } = await params;
  if (!isRegion(region)) notFound();
  return <StrongholdLeaderboardPage region={region} tierParam={tier} />;
}
