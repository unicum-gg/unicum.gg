import type { Metadata } from "next";
import { mapCommunityMetadata } from "@/app/[locale]/(site)/[region]/maps/community/page";
import { MapCommunityView } from "@/components/maps/list/community/view";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /maps/community renders the same board as /eu/maps/community.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The EU shortcut is the regional page at its region-less address, which the
  // route helpers already answer with, so it says exactly what the page it is a
  // shortcut for says rather than a copy of that call.
  return mapCommunityMetadata(Region.EU, locale);
}

export default async function MapCommunityPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <MapCommunityView locale={locale} region={Region.EU} />;
}
