import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
  type Region,
} from "@unicum.gg/wargaming";
import {
  TournamentsBoard,
  type TournamentListRow,
} from "@/components/tournaments/list/board";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { MyTournaments } from "@/components/tournaments/list/mine";
import { TournamentSchedule } from "@/components/tournaments/list/schedule";
import { isTournamentLive, isTournamentOpen } from "@unicum.gg/shared";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { buildSafe, unicum } from "@/services/sdk";

// ISR like the other catalogue pages: the list moves only as tournaments open
// and settle, and a navigation should serve prerendered HTML rather than pay a
// render. Short revalidate because registration counts move while a tournament
// is open.
export const dynamic = "force-static";
export const revalidate = 900;

// One page of the catalogue, deep enough to cover a season of dailies plus every
// open tournament, without shipping the whole 2018-onwards archive to a browser
// that only wanted to know what is on tonight.
const PAGE_SIZE = 100;

async function loadRows(region: Region): Promise<TournamentListRow[]> {
  const res = await buildSafe(
    () => unicum.region(region).tournaments.list({ limit: PAGE_SIZE }),
    { results: [], totalCount: 0 },
  );
  return res.results as unknown as TournamentListRow[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const regionLabel = region.toUpperCase();
  return constructMetadata({
    title: `World of Tanks tournaments (${regionLabel})`,
    description: `Every Wargaming tournament on ${regionLabel}: the daily gold ladders, the clan championships, who entered and who won. Full brackets, scores and rosters.`,
    canonical: ROUTES.TOURNAMENTS(region),
  });
}

export default async function TournamentsPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  const rows = await loadRows(region);
  // What a reader can act on right now, which is the one number worth putting
  // in the intro: the page holds a window of the archive, so a total would say
  // how much we fetched rather than how much there is.
  const live = rows.filter(
    (r) => isTournamentOpen(r.status) || isTournamentLive(r.status),
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* The site's listing hero, the same one /maps, /tanks and /clans open
          with, so this section reads as a sibling rather than its own design. */}
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm tracking-wide text-fd-muted-foreground uppercase">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            World of Tanks <span className="text-brand">tournaments</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {live > 0
              ? `${live} tournament${live === 1 ? "" : "s"} open or being played on ${REGION_LABEL[region]} right now, `
              : `Tournaments run on ${REGION_LABEL[region]} every day, `}
            from 1v1 ladders playing for gold to clan championships playing for
            cash. Full brackets and scores, every team with its roster, and the
            side each one started on, map by map.
          </p>
        </PanelContent>
      </Panel>

      {/* The timetable before the catalogue: "what is on tonight" is the
          question this page gets opened with, and a list sorted by date answers
          it only after the reader has done the arithmetic. It carries its own
          separator, since it renders nothing when nothing is scheduled ahead. */}
      {/* Ahead of the timetable: a reader who has played wants their own record
          first. Renders nothing when signed out, and carries its own separator
          for the same reason the schedule does. */}
      <MyTournaments />

      <TournamentSchedule region={region} rows={rows} />

      <PanelSeparator />

      <TournamentsBoard region={region} rows={rows} />
    </div>
  );
}
