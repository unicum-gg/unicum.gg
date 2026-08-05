import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  mapsIndexMetadata,
  renderMapsIndex,
} from "@/app/(site)/[region]/maps/page";
import { battleTypeFromSegment } from "@/components/maps/list/tabs";
import { BattleType } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";

// One route per battle type, so each is a real indexable page with its own
// heading, title and description instead of a `?type=` filter Google treats as
// a single page. A dynamic segment rather than eleven near-identical files; the
// set is closed, so every value is prerendered and anything else 404s.
export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(BattleType).map((type) => ({ type }));
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
