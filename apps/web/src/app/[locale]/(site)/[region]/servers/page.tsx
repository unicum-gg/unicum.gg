import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";
import { ServersView } from "@/components/servers";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";

// ISR like the other landings: prerendered HTML, revalidated in the background.
// The range switcher is read client-side (ServersDashboard), so the page needs
// no searchParams and stays static. The headline count does not go stale with
// the page: it arrives over SSE, live.
//
// Five minutes, matching the sampling interval. A shorter window would only
// re-render the same numbers, since nothing writes between two samples.
export const dynamic = "force-static";
export const revalidate = 300;

export function generateStaticParams() {
  // EU lives at /servers (app/(site)/servers), so only NA and ASIA here.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

export async function serversMetadata(region: string, locale: string): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/servers/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.SERVERS(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  return serversMetadata(region, locale);
}

export default async function ServersPage({
  params,
}: {
  params: Promise<{ region: string; locale: string }>;
}) {
  const { region, locale } = await params;
  if (!isRegion(region)) notFound();
  return <ServersView locale={locale} region={region} />;
}
