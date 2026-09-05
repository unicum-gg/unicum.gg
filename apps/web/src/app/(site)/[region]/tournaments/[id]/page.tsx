import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnicumError } from "@unicum.gg/sdk";
import { TOURNAMENT_GAME_MODE_LABEL, teamFormat } from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { TournamentView } from "@/components/tournaments/detail/view";
import type { TournamentRecord } from "@/components/tournaments/detail/record";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum } from "@/services/sdk";

// Dynamic, like the player, clan and tank pages: AGENTS puts per-entity pages
// here and their caching in the endpoints, and 5,939 mirrored tournaments (each
// holding a full bracket) is precisely the shape that made that rule. The
// endpoint serves this read with `max-age=300`, so the per-request cost is a
// local hop onto a cached payload rather than a bracket rebuilt per view.
export const dynamic = "force-dynamic";

async function loadTournament(
  region: Region,
  id: string,
): Promise<TournamentRecord | null> {
  try {
    return (await unicum
      .region(region)
      .tournaments(id)
      .detail()) as unknown as TournamentRecord;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; id: string }>;
}): Promise<Metadata> {
  const { region, id } = await params;
  if (!isRegion(region)) return {};
  const t = await loadTournament(region, id).catch(() => null);
  if (!t) return {};
  const regionLabel = region.toUpperCase();
  const modes = t.gameModes.map((m) => TOURNAMENT_GAME_MODE_LABEL[m]).join(", ");
  return constructMetadata({
    title: `${t.title}, World of Tanks tournament (${regionLabel})`,
    description:
      `${t.title} on ${regionLabel}: ${t.confirmedTeams} teams in ${teamFormat(t.minPlayersInTeam)}` +
      `${modes ? ` ${modes}` : ""}, with the full bracket, every score and every roster.`,
    canonical: ROUTES.TOURNAMENT(region, t.id),
    ogImage: `/api/og/${region}/tournaments/${t.id}`,
  });
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ region: string; id: string }>;
}) {
  const { region, id } = await params;
  if (!isRegion(region)) notFound();
  const tournament = await loadTournament(region, id);
  if (!tournament) notFound();
  // The site's page container: every other page centres on it, and without it
  // the panels' side borders sit off-screen and the content runs edge to edge.
  return (
    <div className="mx-auto w-full max-w-7xl">
      <TournamentView region={region} tournament={tournament} />
    </div>
  );
}
