import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnicumError } from "@unicum.gg/sdk";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import {
  tournamentTeamContext,
  type TournamentRecord,
} from "@/components/tournaments/detail/record";
import {
  finalPlacements,
  placeSpans,
} from "@/components/tournaments/detail/placements";
import { teamRatingStandings } from "@/components/tournaments/detail/team-rating";
import { teamRun } from "@/components/tournaments/detail/team-run";
import { TournamentTeamView } from "@/components/tournaments/team/view";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { buildSafe, unicum } from "@/services/sdk";
import type { RosterEntry } from "@/components/tournaments/team/roster-table";
import { withDictionaries } from "@/components/dictionaries";

// ISR on the same window as the bracket this page is a slice of. That page
// documents why, and the two measurements it rests on apply here unchanged: the
// endpoint's `max-age=300` caches nothing the render pays for, and
// `force-dynamic` forbade the edge to hold the result. This is the heaviest page
// of the family, at 923 ms of CPU per request over 476 requests in forty
// minutes, and the one whose output is most worth holding: it reads the WHOLE
// tournament to render one team, so every hit rebuilt the entire bracket, up to
// 7,647 teams on the EU championship measured, to print a single roster.
//
// That read is also why this route carried the stronger objection, which was
// answered with a bet on the LRU, and the bet lost. Keyed statically over
// 455,505 teams, the reasoning was that an entry nobody asks for twice is by
// construction the least recently used, so these would be exactly the entries
// LRU drops. Measured 2026-11-10, it dropped everything else instead: 94 of
// these pages held 1,946 MB, 49.1% of a 4 GB store that held 1,006 keys in all,
// averaging 20.70 MB each and reaching 40.00 MB, so the store sat full at
// 3.95 GB and evicted 5.3 keys a second for a 64.5% hit rate, taking the player
// and clan pages readers were actually asking for down with it.
//
// That 20.70 MB is the whole tournament stored twice, because the props a
// `"use client"` view is handed are serialised into the flight data, and an
// entry holds that twice over: inlined in the HTML so the browser can hydrate,
// then again as the cached RSC payload. So a 10 MB tournament handed whole to
// the view below cost about 20 MB a team. It is now handed a projection and
// three derived values instead, measured over all 7,647 teams of that
// tournament at 7.8 KB of props on average and 15.6 KB on the heaviest, against
// 9,877 KB, and what is left in an entry is this page's own markup. See
// `TournamentTeamContext` for which fields cross and why the two that do not are
// the whole weight.
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

async function TournamentTeamPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; id: string; teamId: string }>;
}) {
  const { region, id, teamId } = await params;
  if (!isRegion(region)) notFound();
  const loaded = await load(region, id, teamId);
  if (!loaded) notFound();
  const { tournament } = loaded;
  const team = tournament.teams.find((t) => t.id === loaded.teamId);
  if (!team) notFound();
  // The roster's stats come from their own endpoint, so a bracket page never
  // pays to join fifty teams' worth of accounts. `buildSafe` because the run
  // below is the page's spine: a roster read that fails should cost the table,
  // not the page.
  const roster = await buildSafe(
    () =>
      unicum
        .region(region)
        .tournaments(String(tournament.id))
        .team(String(team.id)),
    null,
  );
  // Everything the view used to derive from the bracket and the field is
  // derived here instead. The view is `"use client"`, so a prop it is handed is
  // serialised whole into the cached payload, and these three derivations were
  // the only readers of the two fields that ARE a tournament's weight: the run
  // is this team's own ties, the place is one number, and the standings are two.
  const placements = new Map(
    finalPlacements(tournament.stages).map((p) => [p.teamId, p.position]),
  );
  const placement = placements.get(team.id);
  // A knockout stores a tie at its LOWEST place (both beaten semi-finalists are
  // recorded as 4), and a ranking is written at its best: two teams tied for
  // third are both 3rd.
  const place =
    placement === undefined
      ? undefined
      : (placeSpans(placements).get(placement)?.from ?? placement);
  return (
    <div className="mx-auto w-full max-w-7xl">
      <TournamentTeamView
        region={region}
        tournament={tournamentTeamContext(tournament)}
        team={team}
        run={teamRun(tournament, team.id)}
        place={place}
        placedTeams={placements.size}
        standings={teamRatingStandings(tournament.teams, team)}
        roster={(roster?.players ?? null) as RosterEntry[] | null}
      />
    </div>
  );
}

export default withDictionaries(
  "[locale]/(site)/[region]/tournaments/[id]/team/[teamId]",
  TournamentTeamPage,
);
