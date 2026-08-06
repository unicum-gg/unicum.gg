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
//
// No `dynamicParams = false` here, even though the set of battle types is
// closed. Our ISR cache is a custom `cacheHandler` (see `cache-handler.js`),
// which replaces the filesystem cache and is deliberately never written during
// `next build`, so at runtime every prerendered path starts as a cache miss. On
// a normal static page a miss just re-renders and heals; with
// `dynamicParams = false` Next reads the flag as "never render a path I did not
// seed" and answers a hard 404 instead, on every battle type, forever. The
// `notFound()` below already rejects anything that is not a battle type, so the
// flag was only ever a redundant second gate.
export const dynamic = "force-static";
export const revalidate = 3600;

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
