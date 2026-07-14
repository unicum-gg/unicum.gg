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

// Dynamic on purpose: the page consumes our own /coverage API through the SDK
// (fetching at build time would make the build depend on a running API). The
// endpoint itself caches for 60s server-side, so per-request cost is one local
// HTTP hop onto a cached payload.
export const dynamic = "force-dynamic";
