import type { Metadata } from "next";
import { steelHunterMetadata } from "@/app/[locale]/(site)/[region]/players/steel-hunter/page";
import { SteelHunterView } from "@/components/players/list/steel-hunter/view";
import { Region } from "@unicum.gg/wargaming";

// ISR, like the WNX landing: prerendered HTML revalidated in the background so
// navigation stays instant while the board follows the cron's cadence.
export const dynamic = "force-static";
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The EU shortcut is the regional page at its region-less address, which the
  // route helpers already answer with, so it says exactly what the page it is a
  // shortcut for says. It used to say it in a copy of that call, which is how
  // two of them ended up interpolating one value fewer than the string they
  // were reading asked for, and printing the placeholder at a reader.
  return steelHunterMetadata(Region.EU, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SteelHunterView locale={locale} region={Region.EU} page={1} />;
}
