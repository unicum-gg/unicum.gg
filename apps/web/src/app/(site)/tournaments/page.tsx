import type { Metadata } from "next";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import TournamentsPage from "@/app/(site)/[region]/tournaments/page";

// The region-less shortcut, the same one `/players` and `/maps` carry: a short
// canonical URL for the section, rendering the EU catalogue. It exists because
// the nav is region-less (the "More" menu is built server-side with no region
// in hand) and because a section deserves a URL without a region in it.
//
// `canonical` points at the regional page, so this and `/eu/tournaments` are not
// two pages competing for the same content.
export const dynamic = "force-static";
export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `World of Tanks tournaments (${label})`,
    description: `Every Wargaming tournament on ${label}: the daily gold ladders, the clan championships, who entered and who won. Full brackets, scores and rosters.`,
    ogTitle: "Tournaments",
    ogSubtitle: `${label} brackets and results`,
    canonical: ROUTES.TOURNAMENTS(Region.EU),
  });
}

export default function TournamentsShortcut() {
  return TournamentsPage({ params: Promise.resolve({ region: Region.EU }) });
}
