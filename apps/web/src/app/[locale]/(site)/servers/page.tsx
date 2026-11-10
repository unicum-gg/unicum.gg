import type { Metadata } from "next";
import { serversMetadata } from "@/app/[locale]/(site)/[region]/servers/page";
import { ServersView } from "@/components/servers";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

// EU shortcut: /servers renders the same page as /eu/servers. ISR on the same
// window as the regional one.
export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return serversMetadata(Region.EU, locale);
}

async function ServersPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ServersView locale={locale} region={Region.EU} />;
}

export default withDictionaries("[locale]/(site)/servers", ServersPageEU);
