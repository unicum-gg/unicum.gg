import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnicumError } from "@unicum.gg/sdk";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import type { TournamentRecord } from "@/components/tournaments/detail/record";
import { TournamentTeamView } from "@/components/tournaments/team/view";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { buildSafe, unicum } from "@/services/sdk";
import type { RosterEntry } from "@/components/tournaments/team/roster-table";

// Dynamic, like every other per-entity page on the site, and here the rule
// earns its keep twice over. There are 455,505 mirrored teams, and this page
// reads the WHOLE tournament (every team, every roster, the entire bracket) to
// render one of them: cached statically, each of those entries would store the
// full payload, which is the unbounded-ISR growth that once filled the disk and
// took the database down. The caching belongs to the endpoint, which already
// serves this read with `max-age=300`, so a page view is a local hop onto a
// cached payload rather than a new entry in an unbounded store.
export const dynamic = "force-dynamic";

/**
 * A team's own page, at the path Wargaming addresses one on
 * (`/tournaments/{id}/team/{teamId}`), so a link from their site or a habit
 * from it lands somewhere familiar.
 *
 * It reads the tournament and filters, rather than having an endpoint of its
 * own: a tournament is small, the payload already carries every tie and every
 * roster, and one cached read serves both this page and the bracket it came
 * from.
 */
async function load(
  region: Region,
  id: string,
  teamId: string,
): Promise<{ tournament: TournamentRecord; teamId: number } | null> {
  const numericTeam = Number(teamId);
  if (!Number.isSafeInteger(numericTeam) || numericTeam <= 0) return null;
  try {
    const tournament = (await unicum
      .region(region)
      .tournaments(id)
      .detail()) as unknown as TournamentRecord;
    return { tournament, teamId: numericTeam };
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; id: string; teamId: string }>;
}): Promise<Metadata> {
  const { region, id, teamId } = await params;
  if (!isRegion(region)) return {};
  const loaded = await load(region, id, teamId).catch(() => null);
  const team = loaded?.tournament.teams.find((t) => t.id === loaded.teamId);
  if (!loaded || !team) return {};
  const regionLabel = region.toUpperCase();
  return constructMetadata({
    title: `${team.title} in ${loaded.tournament.title} (${regionLabel})`,
    description: `Every match ${team.title} played in ${loaded.tournament.title} on ${regionLabel}: the side they started on, the maps, the scores, and the roster they fielded.`,
    canonical: ROUTES.TOURNAMENT_TEAM(region, loaded.tournament.id, team.id),
    ogImage: `/api/og/${region}/tournaments/${loaded.tournament.id}/team/${team.id}`,
  });
}

export default async function TournamentTeamPage({
  params,
}: {
  params: Promise<{ region: string; id: string; teamId: string }>;
}) {
  const { region, id, teamId } = await params;
  if (!isRegion(region)) notFound();
  const loaded = await load(region, id, teamId);
  if (!loaded) notFound();
  const team = loaded.tournament.teams.find((t) => t.id === loaded.teamId);
  if (!team) notFound();
  // The roster's stats come from their own endpoint, so a bracket page never
  // pays to join fifty teams' worth of accounts. `buildSafe` because the run
  // below is the page's spine: a roster read that fails should cost the table,
  // not the page.
  const roster = await buildSafe(
    () =>
      unicum
        .region(region)
        .tournaments(String(loaded.tournament.id))
        .team(String(team.id)),
    null,
  );
  return (
    <div className="mx-auto w-full max-w-7xl">
      <TournamentTeamView
        region={region}
        tournament={loaded.tournament}
        team={team}
        roster={(roster?.players ?? null) as RosterEntry[] | null}
      />
    </div>
  );
}
