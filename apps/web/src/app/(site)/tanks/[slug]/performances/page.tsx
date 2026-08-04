import type { Metadata } from "next";
import {
  renderTankPage,
  tankMetadata,
} from "@/app/(site)/[region]/tanks/[slug]/page";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/:slug/performances mirrors /eu/tanks/:slug/performances.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return tankMetadata(Region.EU, slug, TankDetailTab.Performances);
}

export default async function TankPerformancesPageEU({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderTankPage(Region.EU, slug, TankDetailTab.Performances);
}
