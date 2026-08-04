import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderMapPage,
} from "@/app/(site)/[region]/maps/[slug]/page";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /maps/:slug renders the same detail as /eu/maps/:slug.
export const dynamic = "force-static";
export const revalidate = 3600;

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return generateRegionMetadata({
    params: params.then(({ slug }) => ({ region: Region.EU, slug })),
  });
}

export default async function MapDetailPageEU({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderMapPage(Region.EU, slug);
}
