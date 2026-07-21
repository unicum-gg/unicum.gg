import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StrongholdLeaderboardPage } from "@/components/clans/stronghold-leaderboard-page";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, REGION_LABEL } from "@unicum.gg/wargaming";
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

// Dynamic on purpose: the page reads searchParams (tab/sort) and consumes our
// own API through the SDK. The endpoints cache server-side, so the per-request
// cost is local HTTP hops onto cached payloads.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; tier: string }>;
}): Promise<Metadata> {
  const { region, tier } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  const tierEnum = parseTier(tier);
  const tierLabel = STRONGHOLD_TIER_LABEL[tierEnum];
  return constructMetadata({
    title: `Top ${tierLabel} clans (${label})`,
    description: `${label} ${tierLabel} clan leaderboard. Ranked by SR (skirmish rating), ELO, battles, and win rate. Minimum ${STRONGHOLD_MIN_BATTLES[tierEnum]} battles.`,
    canonical: ROUTES.STRONGHOLD(region, tierEnum),
  });
}

export default async function RegionStrongholdPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; tier: string }>;
  searchParams: Promise<{ sort?: string; period?: string }>;
}) {
  const [{ region, tier }, { sort, period }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isRegion(region)) notFound();
  return (
    <StrongholdLeaderboardPage
      region={region}
      tierParam={tier}
      sortParam={sort}
      periodParam={period}
    />
  );
}
