"use client";

import Link from "next/link";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { isRegion, Region } from "@/services/wargaming/wot";

/**
 * "See all →" affordance rendered in the Top players Overall panel
 * header. Mirrors the region resolution used by `TopPlayers` so the
 * link always points to the leaderboard the user is actually looking
 * at. Points at the dedicated `/top` leaderboards page, which surfaces
 * the full 24h / 7d / overall player lists plus the clan leaderboard.
 */
export function TopPlayersLeaderboardLink({
  regionOverride,
}: {
  regionOverride?: Region;
}) {
  const [storedRegion] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const region: Region =
    regionOverride ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  return (
    <Link
      href={ROUTES.TOP(region)}
      className={cn(
        styles.linkHover,
        "text-xs font-medium uppercase tracking-wide text-fd-muted-foreground",
      )}
    >
      See all →
    </Link>
  );
}
