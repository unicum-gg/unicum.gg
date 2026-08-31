import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";
import { ServersView } from "@/components/servers";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";

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

export async function serversMetadata(region: string): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `World of Tanks players online (${label})`,
    description: `How many players are on each World of Tanks ${label} server right now, with the population over the last 24 hours, week and year, the all-time record, and the busiest hours of the week.`,
    ogTitle: "Server population",
    ogSubtitle: `${label} players online`,
    canonical: ROUTES.SERVERS(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  return serversMetadata(region);
}

export default async function ServersPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  return <ServersView region={region} />;
}
