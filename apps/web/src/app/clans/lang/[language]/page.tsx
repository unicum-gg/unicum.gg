import type { Metadata } from "next";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language } = await params;
  const name = languageDisplayName(language);
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Top ${name} World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as one of their languages, ranked by WNX.`,
    ogTitle: `Top ${name} clans`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.CLANS_BY_LANGUAGE(Region.EU, language),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  return (
    <ClansLandingView region={Region.EU} language={language} strict={false} />
  );
}

// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// Language params are generated on demand (no build-time prerender, so the
// build never depends on a running API) and cached between revalidations.
export const dynamic = "force-static";
export const revalidate = 600;
