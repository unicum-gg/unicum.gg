import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@/services/wargaming/wot";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; language: string }>;
  searchParams: Promise<{ strict?: string }>;
}): Promise<Metadata> {
  const [{ region, language }, { strict }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isRegion(region)) return {};
  const name = languageDisplayName(language);
  const label = REGION_LABEL[region];
  const isStrict = strict === "1";
  return constructMetadata({
    title: isStrict
      ? `Strictly ${name} World of Tanks players (${label})`
      : `Top ${name} World of Tanks players (${label})`,
    description: isStrict
      ? `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language is exclusively ${name}, ranked by WNX.`
      : `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language set includes ${name}, ranked by WNX.`,
    ogTitle: isStrict ? `Strictly ${name} players` : `Top ${name} players`,
    ogSubtitle: `${label} leaderboard`,
  });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; language: string }>;
  searchParams: Promise<{ strict?: string }>;
}) {
  const [{ region, language }, { strict }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isRegion(region)) notFound();
  if (region === Region.EU) {
    redirect(
      ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language) +
        (strict === "1" ? "?strict=1" : ""),
    );
  }
  // No notFound() when the language isn't in our player pool. The page
  // renders an empty state instead so a clans-to-players tab swap on a
  // language that's present clan-side but missing player-side stays
  // navigable rather than 404ing under the user.
  return (
    <PlayersLandingView
      region={region}
      language={language}
      strict={strict === "1"}
    />
  );
}

export const revalidate = 600;
