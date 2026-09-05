"use client";

import { ArrowSquareOutIcon, RankingIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { usePassed } from "@/hooks/use-passed";
import { RankMedal } from "@/components/rank-medal";
import { ScrollRail } from "@/components/scroll-rail";
import Link from "next/link";
import Image from "next/image";
import { Fragment, useMemo } from "react";
import { tierBand } from "@/components/tournaments/tier-label";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { unicumPublic } from "@/services/sdk";
import ROUTES from "@/constants/routes";
import { TournamentStatusBadge } from "@/components/tournaments/status-badge";
import {
  isTournamentLive,
  isTournamentOpen,
  rosterLimits,
  teamFormat,
  TOURNAMENT_GAME_MODE_LABEL,
} from "@unicum.gg/shared";
import {
  REGION_LABEL,
  REGION_WOT_HOST,
  TournamentStatus,
  type Region,
} from "@unicum.gg/wargaming";
import { TournamentActionsMenu } from "./actions-menu";
import { TournamentBracket } from "./bracket";
import { tournamentOutcome } from "./outcome";
import { finalPlacements } from "./placements";
import { TournamentMapPool, mapHrefIndex } from "./map-pool";
import { bandLabel, bandPlace, splitTiers } from "./prize-tiers";
import { TournamentTeams } from "./teams";
import { TournamentRules } from "./rules";
import type { TournamentRecord } from "./record";

/** The band as this table shows it: the numeral, or its own placeholder. */
const tierBandOrDash = (from: number | null, to: number | null) =>
  tierBand(from, to) ?? DASH;

const DASH = "—";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * One tournament: what it was, who entered, and how it played out.
 *
 * Everything here is mirrored from Wargaming's tournament system, which renders
 * its own pages client-side, so this is the version a crawler and a reader
 * without JavaScript can actually read.
 */
export function TournamentView({
  region,
  tournament,
}: {
  region: Region;
  tournament: TournamentRecord;
}) {
  const t = tournament;
  // Memoized because it is passed into a component that keys memoized work on
  // its identity, so rebuilding it each render would defeat that (and did,
  // until a rebuilt list drove the teams table into a render loop).
  const placements = useMemo(
    () => new Map(finalPlacements(t.stages).map((p) => [p.teamId, p.position])),
    [t.stages],
  );
  // Built here, where the pool and the battle type both live, so a map named in
  // a bracket card opens exactly the view the tile in the pool above does.
  const mapLinks = useMemo(
    () => mapHrefIndex(region, t.mapPool, t.gameModes),
    [region, t.mapPool, t.gameModes],
  );
  // Answers "who won" without making the reader open every bracket, which a
  // qualifier drawn as parallel groups otherwise requires.
  const outcome = useMemo(() => tournamentOutcome(t.stages), [t.stages]);
  const prizes = useMemo(() => splitTiers(t.prizeTiers), [t.prizeTiers]);
  const teamNames = useMemo(
    () => new Map(t.teams.map((team) => [team.id, team.title])),
    [t.teams],
  );
  // Only for the qualifier case: with a placement column, the rank already says
  // who went through.
  const advanced = useMemo(
    () =>
      outcome?.kind === "qualified" ? new Set(outcome.teamIds) : new Set<number>(),
    [outcome],
  );
  // Client-only: the page is `force-static`, so a deadline compared against the
  // server's clock would be baked into HTML served hours later.
  const closed = usePassed(t.registrationTill);
  // Wargaming's status lags its own deadline, so the date decides: past it, the
  // form is shut whatever the status still says.
  const canRegister =
    t.status === TournamentStatus.RegistrationStarted && !closed;
  const roster = rosterLimits(t.minPlayersInTeam, t.maxPlayersInTeam);
  const servers = [...new Set(t.schedule.map((s) => s.title).filter(Boolean))];

  // The meta strip, in the order a competitor reads it: where, when, what it is
  // played as, and what it pays. Built as a list so an absent one (a tournament
  // with no tier band, no prize) drops out instead of leaving a dangling dot.
  const metaParts = [
    REGION_LABEL[region],
    dateFmt.format(t.startAt),
    t.gameModes.map((m) => TOURNAMENT_GAME_MODE_LABEL[m]).join(", "),
    tierBandOrDash(t.tierFrom, t.tierTo) === DASH
      ? null
      : `Tier ${tierBandOrDash(t.tierFrom, t.tierTo)}`,
    roster
      ? `${teamFormat(t.minPlayersInTeam)} (${roster})`
      : teamFormat(t.minPlayersInTeam),
    // Out of the cap when there is one: "23 teams" says how many entered,
    // "23 / 64 teams" says whether there is still room.
    t.confirmedTeams > 0
      ? t.teamsLimit
        ? `${t.confirmedTeams} / ${t.teamsLimit} teams`
        : `${t.confirmedTeams} teams`
      : null,
    // The tier-point cap a team may field at once, which is a real constraint on
    // what you can bring and appears nowhere else on the page.
    t.totalLevelTo ? `${t.totalLevelTo} tier points` : null,
    // The game server the session runs on, which Wargaming's own page labels
    // "Server" and a captain needs on the night. We stored it in the schedule
    // and never showed it.
    servers.length > 0 ? `Server ${servers.join(", ")}` : null,
    t.prize,
  ].filter((v): v is string => Boolean(v));

  return (
    <>
      {/* The site's detail-page header: title row, then a dot-separated meta
          strip, the same shape a player and a map open with. */}
      <Panel>
        <PanelContent className="p-0">
          <header className="flex flex-col">
            {/* The identity row. The result below is NOT in it: kept inside the
                column beside the logo, its rule stopped at the logo's edge and
                left the square hanging with nothing closing it. */}
            <div className="flex flex-col sm:flex-row sm:items-stretch">
            {/* `sm:contents` so the logo stays BESIDE the title on a phone, the
                way the clan and team headers do it: stacked, it took a line of
                its own with a rule that stopped at its own width, and pushed
                the title below the fold. From `sm` up the wrapper dissolves and
                both become columns of the header row. */}
            <div className="flex items-stretch sm:contents">
            {/* The organiser's own logo in the square the clan page gives an
                emblem. 524 of 536 EU tournaments carry one and the big series
                are branded, so it is what identifies an event at a glance.
                Asia holds a handful of non-URL values, hence the `http` test
                rather than a bare null check. */}
            {t.logoUrl?.startsWith("http") ? (
              <div className="flex size-24 shrink-0 items-center justify-center border-r border-fd-border p-3">
                <Image
                  src={t.logoUrl}
                  alt=""
                  width={192}
                  height={192}
                  className="size-full object-contain"
                />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-3 px-4 py-3">
              {!t.logoUrl?.startsWith("http") && (
                <RankingIcon className="size-7 shrink-0 text-fd-muted-foreground" />
              )}
              <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight sm:text-4xl">
                {t.title}
              </h1>
              <TournamentStatusBadge status={t.status} />
              <TournamentActionsMenu
                region={region}
                tournamentId={t.id}
                title={t.title}
                path={ROUTES.TOURNAMENT(region, t.id)}
                ogImage={unicumPublic.og
                  .region(region)
                  .tournaments(String(t.id))
                  .url()}
              />
            </div>
            {/* One line, scrolled rather than wrapped, like the team header
                below it: this strip holds ten facts and wrapping them grew the
                header by a line every time the window narrowed. */}
            <div className="border-t border-fd-border text-xs text-fd-muted-foreground">
              <ScrollRail
                compact
                className="flex items-center gap-x-2 px-4 py-2 whitespace-nowrap"
              >
                <Link
                  href={ROUTES.TOURNAMENTS(region)}
                  className="shrink-0 hover:text-fd-foreground hover:underline"
                >
                  Tournaments
                </Link>
                {metaParts.map((part) => (
                  <Fragment key={part}>
                    <span className="shrink-0 text-fd-border">·</span>
                    <span className="shrink-0">{part}</span>
                  </Fragment>
                ))}
              </ScrollRail>
            </div>
            </div>
            </div>
            </div>
            {outcome && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-fd-border px-4 py-2 text-sm">
                <span className="flex items-center gap-1.5 text-xs tracking-wide text-fd-muted-foreground uppercase">
                  {outcome.kind === "winner" ? (
                    <>
                      <RankMedal rank={1} className="h-4" />
                      {outcome.teamIds.length > 1 ? "Winners" : "Winner"}
                    </>
                  ) : (
                    `Qualified (${outcome.teamIds.length})`
                  )}
                </span>
                {outcome.teamIds.map((teamId, i) => (
                  <Fragment key={teamId}>
                    {i > 0 && <span className="text-fd-border">·</span>}
                    <Link
                      href={ROUTES.TOURNAMENT_TEAM(region, t.id, teamId)}
                      className="font-medium hover:underline"
                    >
                      {teamNames.get(teamId) ?? teamId}
                    </Link>
                  </Fragment>
                ))}
              </div>
            )}
          </header>
        </PanelContent>
      </Panel>

      {/* The organiser's own note. We mirror it, sanitize it, and never showed
          it: it is where a tournament says the thing its title cannot ("Onslaught
          Modifiers and descriptions apply"), and Wargaming gives it a section of
          its own. */}
      {t.description.trim().length > 0 && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelContent
              className="prose-sm p-4 text-sm text-fd-muted-foreground [&_a]:text-brand [&_a]:hover:underline"
              dangerouslySetInnerHTML={{ __html: t.description }}
            />
          </Panel>
        </>
      )}

      {(t.prizeTiers.length > 0 || t.mapPool.length > 0 || canRegister) && (
        <>
          <PanelSeparator />
          {/* Two panels side by side, the way the tank page sets Ammunition
              against Crew Skills: what the tournament pays and where it is
              played are two different questions, and a single panel with two
              headings inside it reads as one. `items-stretch` keeps the shorter
              column's frame running to the bottom, and a lone panel spans the
              width rather than sitting beside an empty half. Narrow screens
              stack, so the vertical rule gives way to a horizontal one. */}
          <div
            className={cn(
              "screen-line-before screen-line-after",
              (t.prizeTiers.length > 0 || canRegister) &&
                t.mapPool.length > 0 &&
                "grid grid-cols-1 items-stretch divide-y divide-fd-border lg:grid-cols-[minmax(0,2fr)_3fr] lg:divide-y-0",
            )}
          >
            {(t.prizeTiers.length > 0 || canRegister) && (
              <Panel screenLines={false} className="flex flex-col">
                <PanelHeader
                  screenLines={false}
                  className="border-b border-fd-border"
                >
                  <PanelTitle>Prizes</PanelTitle>
                </PanelHeader>
                <PanelContent className="flex flex-1 flex-col p-0">
                  {prizes.bands.length > 0 && (
                    // The same ranked table the home page's leaderboards use, so
                    // a placing reads the same on both: a medal for the podium,
                    // the number for everything under it. A prize list IS a
                    // ranking, and as a run of text lines it was the only one on
                    // the site that did not look like one.
                    <Table className="mb-px! [&_td]:min-w-0 [&_tr]:h-11">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 whitespace-nowrap px-4! text-center!">
                            #
                          </TableHead>
                          <TableHead>Place</TableHead>
                          <TableHead className="pr-4 text-right!">Prize</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Keyed by position, not by `order`: the organiser
                            writes that number themselves and it repeats, so it
                            orders the bands without identifying them. The sort
                            is stable, so equal orders keep source order. */}
                        {prizes.bands.map((tier, i) => {
                          const place = bandPlace(tier.title);
                          return (
                            <TableRow key={i}>
                              <TableCell className="px-2! text-center font-mono tabular-nums text-fd-muted-foreground">
                                {place === 1 || place === 2 || place === 3 ? (
                                  <RankMedal rank={place} className="mx-auto" />
                                ) : (
                                  place
                                )}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                {bandLabel(tier.title)}
                              </TableCell>
                              <TableCell className="pr-4 text-right text-fd-muted-foreground">
                                {tier.prizes.join(" · ")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  {prizes.notes.length > 0 && (
                    <div
                      className={cn(
                        "flex flex-col gap-1 p-4 text-xs text-fd-muted-foreground",
                        prizes.bands.length > 0 && "border-t border-fd-border",
                      )}
                    >
                      {prizes.notes.map((note, i) => (
                        <p key={i}>* {note}</p>
                      ))}
                    </div>
                  )}
                  {/* Under what it pays, which is the order the decision is
                      made in: a reader weighs the prize, then enters. Entering
                      only happens on Wargaming's own site. */}
                  {canRegister && (
                    // Its own row under the table, closed off by a rule: the
                    // prize bands are what the tournament pays and this is what
                    // to do about it, so running them together read as one more
                    // band. The deadline sits opposite the button rather than
                    // above it, since it is the condition on the action.
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 p-4",
                        (prizes.bands.length > 0 || prizes.notes.length > 0) &&
                          "border-t border-fd-border",
                      )}
                    >
                      <Button
                        asChild
                        className="bg-brand text-white hover:bg-brand/90"
                      >
                        <a
                          href={`https://${REGION_WOT_HOST[region]}/en/tournaments/${t.id}/registration/`}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                        >
                          Register
                          <ArrowSquareOutIcon weight="bold" className="size-4" />
                        </a>
                      </Button>
                      {t.registrationTill && (
                        <span className="text-xs text-fd-muted-foreground">
                          Closes{" "}
                          <RelativeTime
                            date={t.registrationTill}
                            title={dateFmt.format(t.registrationTill)}
                          />
                        </span>
                      )}
                    </div>
                  )}
                </PanelContent>
                <div aria-hidden className="flex-1" />
              </Panel>
            )}

            {t.mapPool.length > 0 && (
              <Panel screenLines={false} className="flex flex-col">
                <PanelHeader
                  screenLines={false}
                  className="flex items-center justify-between gap-4 border-b border-fd-border"
                >
                  <PanelTitle>Map pool</PanelTitle>
                  <span className="text-xs text-fd-muted-foreground">
                    {t.mapPool.length} map{t.mapPool.length === 1 ? "" : "s"}
                  </span>
                </PanelHeader>
                {/* No padding: the grid is the panel's content, and a margin
                    around it turned a contact sheet into a framed picture of
                    one. */}
                <PanelContent className="p-0">
                  <TournamentMapPool
                    region={region}
                    maps={t.mapPool}
                    gameModes={t.gameModes}
                  />
                </PanelContent>
                <div aria-hidden className="flex-1" />
              </Panel>
            )}
          </div>
        </>
      )}

      {/* A tournament that has not been drawn yet has no bracket, and a
          separator with nothing under it reads as a section that failed to
          load rather than one that does not exist yet.
          Tested on GROUPS, not on stages: a stage holds the bracket in its
          groups, and a dozen tournaments carry stages that were never drawn, so
          `stages.length` is true while the panel below renders nothing. */}
      {t.stages.some((stage) => stage.groups.length > 0) && (
        <>
          <PanelSeparator />
          <TournamentBracket
            region={region}
            tournamentId={t.id}
            stages={t.stages}
            teams={t.teams}
            mapLinks={mapLinks}
          />
        </>
      )}

      {/* Same rule as the bracket above: a panel that renders nothing must not
          leave its separator behind, or the page shows two hatched bands with
          an empty section between them. The condition has to live here because
          the separator is a sibling, so the panel cannot withhold it itself. */}
      {t.rules.length > 0 && (
        <>
          <PanelSeparator />
          <TournamentRules sections={t.rules} />
        </>
      )}

      <PanelSeparator />
      <TournamentTeams
        region={region}
        tournamentId={t.id}
        teams={t.teams}
        placements={placements}
        maxPlayersInTeam={t.maxPlayersInTeam}
        prizeTiers={t.prizeTiers}
        advanced={advanced}
        // The 30-day column is form, which is what a reader wants while the
        // draw is still ahead and is not part of an archived result.
        scouting={isTournamentOpen(t.status) || isTournamentLive(t.status)}
      />
    </>
  );
}
