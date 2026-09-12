import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderMapsIndex,
} from "@/app/[locale]/(site)/[region]/maps/page";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /maps renders the same index as /eu/maps. ISR like the other
// landings.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateRegionMetadata({
    params: Promise.resolve({ locale, region: Region.EU }),
  });
}

export default async function MapsIndexPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return renderMapsIndex(Region.EU, locale);
}
