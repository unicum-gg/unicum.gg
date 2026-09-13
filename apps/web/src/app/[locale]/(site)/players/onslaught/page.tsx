import type { Metadata } from "next";
import { onslaughtMetadata } from "@/app/[locale]/(site)/[region]/players/onslaught/page";
import { OnslaughtView } from "@/components/players/list/onslaught/view";
import { Region } from "@unicum.gg/wargaming";

// ISR like the other leaderboards: the page renders the current season and is
// cached, so it is a cheap read instead of re-rendering the whole ~4k-row board
// on every request. The season selector's `?season=` is read client-side (see
// OnslaughtBoardLive), so it no longer opts the page into dynamic rendering.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the other boards

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
  return onslaughtMetadata(Region.EU, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <OnslaughtView locale={locale} region={Region.EU} page={1} />;
}
