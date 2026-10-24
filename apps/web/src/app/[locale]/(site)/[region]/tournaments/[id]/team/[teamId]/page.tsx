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

// ISR on the same window as the bracket this page is a slice of. That page
// documents why, and the two measurements it rests on apply here unchanged: the
// endpoint's `max-age=300` caches nothing the render pays for, and
// `force-dynamic` forbade the edge to hold the result. This is the heaviest page
// of the family, at 923 ms of CPU per request over 476 requests in forty
// minutes, and the one whose output is most worth holding: it reads the WHOLE
// tournament to render one team, so every hit rebuilt the entire bracket, up to
// 147 teams on the EU ones measured, to print a single roster.
//
// That read is also why this route carried the stronger objection, and it is now
// the wrong way round. Keyed statically over 455,505 teams, each entry stores
// the full payload, so one tournament's bracket would be held once per team. It
// never accumulates: the ISR store is bounded by a TTL and an LRU key cap on a
// dedicated Redis, and an entry nobody asks for twice is by construction the
// least recently used, so these are exactly the entries LRU drops. What used to
// fill a disk was a cache with no eviction at all.
//
// A team id the tournament does not hold is a 404 cached for the window, which
// is unreachable by navigation for the same reason the vehicle records are: the
// only link to a team is the tournament's own team table, cached on this very
// cadence, so a team registered since the last render is not linked from
// anywhere yet.
export const dynamic = "force-static";
export const revalidate = 900; // 15 min, matches the tournament and the catalogue

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
  params: Promise<{ locale: string; region: string; id: string; teamId: string }>;
}): Promise<Metadata> {
  const { locale, region, id, teamId } = await params;
  if (!isRegion(region)) return {};
  const loaded = await load(region, id, teamId).catch(() => null);
  const team = loaded?.tournament.teams.find((t) => t.id === loaded.teamId);
  if (!loaded || !team) return {};
  const regionLabel = region.toUpperCase();
  return constructMetadata({
    locale,
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
