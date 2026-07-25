import type { Metadata } from "next";
import { StrongholdLeaderboardPage } from "@/components/clans/list/stronghold";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import {
  STRONGHOLD_MIN_BATTLES,
  STRONGHOLD_TIER_LABEL,
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
  params: Promise<{ tier: string }>;
}): Promise<Metadata> {
  const { tier } = await params;
  const label = REGION_LABEL[Region.EU];
  const tierEnum = parseTier(tier);
  const tierLabel = STRONGHOLD_TIER_LABEL[tierEnum];
  return constructMetadata({
    title: `Top ${tierLabel} clans (${label})`,
    description: `${label} ${tierLabel} clan leaderboard. Ranked by SR (skirmish rating), ELO, battles, and win rate. Minimum ${STRONGHOLD_MIN_BATTLES[tierEnum]} battles.`,
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
