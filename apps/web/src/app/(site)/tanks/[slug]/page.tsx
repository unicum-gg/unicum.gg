import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderTankPage,
} from "@/app/(site)/[region]/tanks/[slug]/page";
import { Region } from "@unicum.gg/wargaming";

// Mirror the region page: force-static, on-demand. The tab lives in `?tab=` and
// is read client-side, so this shortcut reads no searchParams and stays static
// (the whole rendered view is cached instead of re-rendering on every hit).
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

// EU shortcut: /tanks/:slug renders the same page as /eu/tanks/:slug.
export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return generateRegionMetadata({
    params: params.then(({ slug }) => ({ region: Region.EU, slug })),
  });
}

export default async function TankPageEU({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderTankPage(Region.EU, slug);
}
