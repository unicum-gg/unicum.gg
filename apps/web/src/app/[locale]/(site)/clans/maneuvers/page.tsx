import type { Metadata } from "next";
import { maneuversClansMetadata } from "@/app/[locale]/(site)/[region]/clans/maneuvers/page";
import { ManeuversClansView } from "@/components/clans/list/maneuvers/view";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return maneuversClansMetadata(Region.EU, locale);
}

async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ManeuversClansView locale={locale} region={Region.EU} />;
}

export default withDictionaries("[locale]/(site)/clans/maneuvers", Page);
