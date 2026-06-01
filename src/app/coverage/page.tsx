import type { Metadata } from "next";
import { CoverageView } from "@/components/coverage/coverage-view";
import { Region, REGION_LABEL } from "@/services/wargaming/wot";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Coverage (${REGION_LABEL[Region.EU]}), what we track, unicum.gg`,
  description: `Live coverage stats for ${REGION_LABEL[Region.EU]} on unicum.gg: players and clans tracked, snapshot counts, cron activity and refresh health.`,
};

export default async function Page() {
  return <CoverageView region={Region.EU} />;
}
