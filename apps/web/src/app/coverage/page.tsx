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

export const dynamic = "force-static";
export const revalidate = 60;
