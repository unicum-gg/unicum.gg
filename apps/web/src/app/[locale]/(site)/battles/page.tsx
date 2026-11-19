import type { Metadata } from "next";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";
import { BattlesView } from "@/components/battles/list/view";
import { battlesMetadata } from "@/app/[locale]/(site)/[region]/battles/page";

// The region-less shortcut, like `/tournaments` and `/players`: the canonical
// EU URL of the section, which `/eu/battles` redirects to.
export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return battlesMetadata(Region.EU, locale);
}

async function BattlesShortcut({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <BattlesView region={Region.EU} locale={locale} />;
}

export default withDictionaries("[locale]/(site)/battles", BattlesShortcut);
