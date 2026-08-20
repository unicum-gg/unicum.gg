import type { Metadata } from "next";
import { CoverageView } from "@/components/coverage/coverage-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `World of Tanks data coverage (${label})`,
    description: `How many World of Tanks players and clans ${APP.NAME} tracks on ${label}, snapshot refresh rate, data depth, infrastructure cost and uptime.`,
    ogTitle: "Data coverage",
    ogSubtitle: `${label} players & clans`,
    canonical: ROUTES.COVERAGE(Region.EU),
  });
}

export default async function Page() {
  return <CoverageView region={Region.EU} />;
}

// ISR: prerendered and revalidated in the background, so the (expensive)
// coverage computation never blocks a visitor. The SDK loopback handles the
// build-time fetch, so a build no longer depends on a running API. The window
// matches the coverage stats' own 60s cache (live-monitoring figures must stay
// fresh) rather than relying on that cache to implicitly lower the segment.
export const dynamic = "force-static";
// 1h, not 60s: the queries are ~24s full seq-scans of the 10M+ row snapshot
// table, so a 60s window paid that scan every minute (and stormed the DB from a
// cold cache). Coverage figures move daily; see the region page for the detail.
export const revalidate = 3600;
