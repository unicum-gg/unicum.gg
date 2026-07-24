import type { Metadata } from "next";
import { SupportView } from "@/components/support/support-view";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "Support unicum.gg",
    description:
      "unicum.gg is free, open-source and ad-free, and it runs at a loss. Support it from €3/month, pay what you want, and keep the World of Tanks tracker alive.",
    ogTitle: "Support unicum.gg",
    ogSubtitle: "Keep the tracker alive",
    canonical: ROUTES.SUPPORT,
  });
}

export default async function Page() {
  return <SupportView />;
}

// ISR like the other catalog pages (incl. /coverage, which shares the heavy
// coverage query): the page is prerendered and served instantly, and the slow
// data fetch happens during background revalidation, never on a user request.
// The podium/funding here can lag up to `revalidate`; the top-bar funding bar
// stays live client-side, so real-time freshness is covered there.
export const dynamic = "force-static";
export const revalidate = 600;
