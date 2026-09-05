import type { Metadata } from "next";
import { BadgesView } from "@/components/badges/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: `Badges on ${APP.NAME}`,
    description:
      "Every badge a World of Tanks player or clan can carry on unicum.gg, and exactly how each one is earned: verified, supporter, streamer, tournament winner, and the stronghold leaderboard crests.",
    ogTitle: `Badges on ${APP.NAME}`,
    ogSubtitle: "What each crest means, and how to earn it",
    canonical: ROUTES.BADGES,
  });
}

// Nothing on this page comes from the database: it describes the rules, which
// change with a deploy and not with the data.
export const dynamic = "force-static";

export default function Page() {
  return <BadgesView />;
}
