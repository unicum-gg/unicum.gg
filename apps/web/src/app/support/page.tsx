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

// The podium reflects live subscription state; low-traffic page, kept fresh.
export const dynamic = "force-dynamic";
