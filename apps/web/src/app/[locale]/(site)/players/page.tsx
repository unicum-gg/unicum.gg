import type { Metadata } from "next";
import { playersLandingMetadata } from "@/app/[locale]/(site)/[region]/players/page";
import { PlayersLandingView } from "@/components/players/list/view";
import { Region } from "@unicum.gg/wargaming";


// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
export const dynamic = "force-static";
export const revalidate = 3600; // 1h: matches the hourly-materialized board data (1800 regenerated twice per data cycle for nothing)

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
  return playersLandingMetadata(Region.EU, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <PlayersLandingView locale={locale} region={Region.EU} language={null} page={1} />
  );
}

