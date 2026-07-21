import type { Metadata } from "next";
import { StrongholdLeaderboardPage } from "@/components/clans/stronghold-leaderboard-page";
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

// Dynamic on purpose: the page reads searchParams (tab/sort) and consumes our
// own API through the SDK. The endpoints cache server-side, so the per-request
// cost is local HTTP hops onto cached payloads.
export const dynamic = "force-dynamic";

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
  searchParams,
}: {
  params: Promise<{ tier: string }>;
  searchParams: Promise<{ sort?: string; period?: string }>;
}) {
  const [{ tier }, { sort, period }] = await Promise.all([params, searchParams]);
  return (
    <StrongholdLeaderboardPage
      region={Region.EU}
      tierParam={tier}
      sortParam={sort}
      periodParam={period}
    />
  );
}
