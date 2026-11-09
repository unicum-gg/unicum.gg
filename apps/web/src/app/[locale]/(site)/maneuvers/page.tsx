import type { Metadata } from "next";
import { maneuversMetadata } from "@/app/[locale]/(site)/[region]/maneuvers/page";
import { ManeuversPage } from "@/components/maneuvers";
import { Region } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The EU shortcut is the regional page at its region-less address, which the
  // route helpers already answer with, so it says exactly what the page it is a
  // shortcut for says rather than saying it again in a copy.
  return maneuversMetadata(Region.EU, locale);
}

export default async function Page() {
  return <ManeuversPage region={Region.EU} />;
}
