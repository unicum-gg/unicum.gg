import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  mapsIndexMetadata,
  renderMapsIndex,
} from "@/app/(site)/[region]/maps/page";
import { battleTypeFromSegment } from "@/components/maps/list/tabs";
import { BattleType } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /maps/all/:type mirrors /eu/maps/all/:type.
export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(BattleType).map((type) => ({ type }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const battleType = battleTypeFromSegment(type);
  if (!battleType) return {};
  return mapsIndexMetadata(Region.EU, battleType);
}

export default async function MapsBattleTypePageEU({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const battleType = battleTypeFromSegment(type);
  if (!battleType) notFound();
  return renderMapsIndex(Region.EU, battleType);
}
