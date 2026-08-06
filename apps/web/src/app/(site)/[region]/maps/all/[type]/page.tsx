import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  mapsIndexMetadata,
  renderMapsIndex,
} from "@/app/(site)/[region]/maps/page";
import { battleTypeFromSegment } from "@/components/maps/list/tabs";
import { BattleType } from "@unicum.gg/shared";
import { isRegion, Region } from "@unicum.gg/wargaming";

// One route per battle type, so each is a real indexable page with its own
// heading, title and description instead of a `?type=` filter Google treats as
// a single page. A dynamic segment rather than eleven near-identical files.
//
// See the EU shortcut (`app/(site)/maps/all/[type]`) for why this must not set
// `dynamicParams = false`: with our custom ISR `cacheHandler` the flag turns
// every prerendered path into a permanent 404.
export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  // Both segments, not just `type`: a leaf's `generateStaticParams` supplies
  // every dynamic segment on its own path (no parent layout declares `region`
  // here), so returning `type` alone yields no concrete path at all. EU lives at
  // `/maps/all/:type`, so only NA and ASIA are enumerated, like the parent
  // `[region]/maps` page.
  return [Region.NA, Region.ASIA].flatMap((region) =>
    Object.values(BattleType).map((type) => ({ region, type })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; type: string }>;
}): Promise<Metadata> {
  const { region, type } = await params;
  const battleType = battleTypeFromSegment(type);
  if (!battleType) return {};
  return mapsIndexMetadata(region, battleType);
}

export default async function MapsBattleTypePage({
  params,
}: {
  params: Promise<{ region: string; type: string }>;
}) {
  const { region, type } = await params;
  if (!isRegion(region)) notFound();
  const battleType = battleTypeFromSegment(type);
  if (!battleType) notFound();
  return renderMapsIndex(region, battleType);
}
