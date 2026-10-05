import type { Metadata } from "next";
import { playerMarksMetadata } from "@/app/[locale]/(site)/[region]/players/marks/page";
import { MarksLandingView } from "@/components/players/list/marks/view";
import { Region } from "@unicum.gg/wargaming";

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
  // shortcut for says rather than saying it again in a copy.
  return playerMarksMetadata(Region.EU, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <MarksLandingView
      locale={locale}
      region={Region.EU}
      language={null}
      page={1}
    />
  );
}
