import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  playerMetadata,
  renderPlayerPage,
} from "@/app/(site)/[region]/players/[nickname]/page";
import {
  PLAYER_VIEWS,
  PlayerSection,
} from "@/components/players/detail/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum, unicumPublic } from "@/services/sdk";
import { isRegion } from "@unicum.gg/wargaming";
import type { PlayerTankDetail } from "@unicum.gg/shared";

// One player's record on one vehicle: the Tanks view with that record open
// beside the table, at a URL of its own so it can be linked and shared.
//
// A static `tanks/` sibling of the `[view]` segment, which keeps serving the
// bare `/tanks` list: a path only matches a route that has a page at its own
// depth, and this one has none at `tanks/`.
export const dynamic = "force-dynamic";

const TANKS_VIEW = PLAYER_VIEWS.find(
  (v) => v.section === PlayerSection.Tanks,
)!;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; nickname: string; slug: string }>;
}): Promise<Metadata> {
  const { region, nickname, slug } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(nickname);

  // The record itself, so the title says which tank rather than repeating the
  // profile's. A player who never played it has no page here, and the base
  // metadata is the honest fallback while the page below 404s.
  const detail = await unicum
    .region(region)
    .players(decoded)
    .tank(slug)
    .then((d) => d as unknown as PlayerTankDetail)
    .catch(() => null);
  if (!detail) return playerMetadata(region, nickname, TANKS_VIEW);

  const name = detail.shortName || detail.name;
  const regionLabel = region.toUpperCase();
  const pct = ((detail.winrate * 100).toFixed(1));
  return constructMetadata({
    title: `${decoded}'s ${name} stats (${regionLabel})`,
    description: `${decoded} on the ${detail.name} in World of Tanks (${regionLabel}): ${detail.battles} battles, ${pct}% winrate, ${Math.round(detail.avgDamage)} average damage, WN8 and WNX on this vehicle.`,
    ogImage: unicumPublic.og
      .region(region)
      .players(decoded)
      .url()
      .replace(/^https?:\/\/[^/]+/, ""),
    canonical: ROUTES.PLAYER_TANK(region, decoded, slug),
  });
}

export default async function PlayerTankPage({
  params,
}: {
  params: Promise<{ region: string; nickname: string; slug: string }>;
}) {
  const { region, nickname, slug } = await params;
  if (!isRegion(region)) notFound();
  return renderPlayerPage(
    region,
    decodeURIComponent(nickname),
    TANKS_VIEW,
    slug,
  );
}
