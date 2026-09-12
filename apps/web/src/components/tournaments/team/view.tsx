"use client";

import { useLocale } from "@onruntime/translations/react";
import { dateLocale } from "@/lib/date-locale";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { format } from "date-fns";
import Link from "@/components/link";
import { useHydrated } from "@/hooks/use-hydrated";
import { Panel, PanelContent, PanelHeader, PanelSeparator, PanelTitle } from "@/components/panel";
import { Fragment } from "react";
import { tierLabel } from "@/components/tournaments/tier-label";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { TournamentActionsMenu } from "@/components/tournaments/detail/actions-menu";
import { ClanTag } from "@/components/entity/clan-tag";
import { RankMedal } from "@/components/rank-medal";
import { ScrollRail } from "@/components/scroll-rail";
import { UNICUM_API_URL } from "@unicum.gg/sdk";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import {
  isTournamentOpen,
  ordinal,
  teamFormat,
} from "@unicum.gg/shared";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import {
  finalPlacements,
  placeSpans,
} from "@/components/tournaments/detail/placements";
import { roundLabel } from "@/components/tournaments/detail/layout";
import {
  bestOfLabel,
  seriesBattles,
} from "@/components/tournaments/detail/match-format";
import { mapPoolIndex, type PoolMapRef } from "@/components/tournaments/detail/map-pool";
import { MatchMinimap } from "@/components/tournaments/detail/match-minimap";
import type { TournamentRecord, TournamentTeam } from "@/components/tournaments/detail/record";
import { TeamSlot, teamRun, type TeamMatch } from "@/components/tournaments/detail/team-run";
import { TeamRosterTable, type RosterEntry } from "./roster-table";
import { TeamMetrics, TeamResult } from "./result";

const DASH = "—";

const DATE_PATTERN = "d MMM yyyy" /* UTC */;

/**
 * When the first battle started, in the reader's OWN time zone.
 *
 * A tie is a slot someone had to show up for, so UTC makes it work to read.
 * date-fns formats in local time by default, which is what is wanted, but this
 * page is `force-static`: rendering local time on the server would bake the
 * build machine's zone into the HTML and mismatch on hydration. So the first
 * render is UTC (correct, just not local) and `useHydrated` swaps it for the
 * reader's own the moment the client takes over.
 */
function KickOff({ at }: { at: Date }) {
  const { locale } = useLocale();
  const { date } = useFormat();
  const { t } = useTranslation("components/tournaments/team/view");
  const hydrated = useHydrated();
  return (
    <time
      dateTime={at.toISOString()}
      className="text-xs text-fd-muted-foreground tabular-nums"
      title={
        hydrated
          ? t("first-battle-at", { when: format(at, "EEEE d MMMM yyyy 'at' HH:mm", { locale: dateLocale(locale) }) })
          : t("when-the-first-battle-started")
      }
    >
      {hydrated
        ? format(at, "d MMM, HH:mm", { locale: dateLocale(locale) })
        : date(UTC_PATTERN).format(at)}
    </time>
  );
}

const UTC_PATTERN = "d MMM, HH:mm" /* UTC */;

/** Which side of the draw the team was on, in the tournament's own terms. */
function SlotPill({ slot }: { slot: TeamSlot }) {
  const { t } = useTranslation("components/tournaments/team/view");
  const one = slot === TeamSlot.One;
  return (
    <span
      className={cn(
        "inline-block rounded-sm px-2 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap uppercase",
        one
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/15 text-red-600 dark:text-red-400",
      )}
    >
      {one ? t("team-1") : t("team-2")}
    </span>
  );
}

/**
 * One tie, laid out flat: the header says who and how it went, the minimaps
 * under it say where each side started.
 *
 * Nothing here is behind a disclosure. This page exists precisely because the
 * answer a competitor wants ("which corner am I in, on which map") was two
 * clicks deep on the tournament page, and a question asked before every match
 * should not need opening twice.
 */
function TieBlock({
  match: m,
  region,
  tournamentId,
  mapLinks,
}: {
  match: TeamMatch;
  region: Region;
  tournamentId: number;
  /** Map name (lowercased) to its page, from the tournament's own pool. */
  mapLinks: Map<string, PoolMapRef>;
}) {
  const { t } = useTranslation("components/tournaments/team/view");
  const { t: tLayout } = useTranslation("components/tournaments/detail/layout");
  const drawable = m.maps.filter((map) => map.pool?.minimapUrl);
  // Truncated to the battles actually played: a series stops once it is decided.
  const battles = seriesBattles(
    drawable,
    (m.scoreFor ?? 0) + (m.scoreAgainst ?? 0),
  );
  return (
    <div className="flex flex-col gap-3 border-b border-fd-border px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs tracking-wide text-fd-muted-foreground uppercase">
          {m.groupCount > 1
            ? t("stage-group", { stage: m.stageTitle, order: m.groupOrder })
            : m.stageTitle}
        </span>
        <span className="text-sm font-medium">
          {roundLabel(m.round, m.bracketType, tLayout)}
        </span>
        {/* The format is nowhere in the source: it follows from the map count,
            which IS the number of wins the series needs. */}
        {bestOfLabel(m.maps.length) && (
          <span className="rounded-sm bg-fd-secondary px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-fd-muted-foreground uppercase">
            {bestOfLabel(m.maps.length)}
          </span>
        )}
        <SlotPill slot={m.slot} />
        <span
          className={cn(
            "text-sm font-semibold",
            m.won === null
              ? "text-fd-muted-foreground"
              : m.won
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-fd-muted-foreground",
          )}
        >
          {m.won === null ? DASH : m.won ? t("won") : t("lost")}
        </span>
        <span className="text-sm tabular-nums">
          {m.scoreFor ?? DASH}
          <span className="text-fd-muted-foreground"> - </span>
          {m.scoreAgainst ?? DASH}
        </span>
        {/* The opponent is a team with its own page, so it links there, and it
            carries its clan for the same reason the header does: the team name
            is whatever their captain typed and rarely says who they were. */}
        {m.startAt && <KickOff at={m.startAt} />}
        <span className="text-sm">
          <span className="text-fd-muted-foreground">vs </span>
          {m.opponent && m.opponentId !== null ? (
            <Link
              href={ROUTES.TOURNAMENT_TEAM(region, tournamentId, m.opponentId)}
              className="hover:underline"
            >
              {m.opponent}
              {m.opponentClan && (
                <>
                  {" "}
                  <ClanTag
                    tag={m.opponentClan.clanTag}
                    color={m.opponentClan.clanColor}
                    className="font-mono text-xs"
                  />
                </>
              )}
            </Link>
          ) : (
            <span className="italic text-fd-muted-foreground">bye</span>
          )}
        </span>
      </div>
      {drawable.length > 0 ? (
        <>
          {/* One minimap per BATTLE, not per map: a map is played twice, once
              from each side, so a Bo5 on three maps is five of these. */}
          <div className="flex flex-wrap gap-4">
            {battles.map(({ map, battle, swapped }) => (
              <MatchMinimap
                key={battle}
                map={map.pool!}
                team1Name={m.team1Name}
                team2Name={m.team2Name}
                viewingSlot={m.slot}
                battle={battle}
                swapped={swapped}
                href={mapLinks.get(map.label.toLowerCase())?.href ?? undefined}
              />
            ))}
          </div>
          {battles.length > 1 && (
            <p className="text-xs text-fd-muted-foreground">
              {t("each-map-is-played-twice")}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-fd-muted-foreground">
          {m.maps.length > 0
            ? t("played-on-uncatalogued", {
                maps: m.maps.map((map) => map.label).join(", "),
              })
            : t("no-maps-recorded")}
        </p>
      )}
    </div>
  );
}

/**
 * One team's page: who they were, and every tie they played with the spawns
 * drawn.
 *
 * A page rather than a row that opens, because this is a thing worth its own
 * URL: a captain sends it to their roster before a match, and it is the answer
 * to the one question tournaments make you look up over and over.
 */
export function TournamentTeamView({
  region,
  tournament,
  team,
  roster,
}: {
  region: Region;
  tournament: TournamentRecord;
  team: TournamentTeam;
  /** The roster joined onto the accounts behind it. Null when the roster read
   * failed, in which case the page still renders the run. */
  roster: RosterEntry[] | null;
}) {
  const { date } = useFormat();
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tMaps } = useTranslation("game/maps");
  const { t } = useTranslation("components/tournaments/team/view");
  const placements = new Map(
    finalPlacements(tournament.stages).map((p) => [p.teamId, p.position]),
  );
  const placement = placements.get(team.id);
  // A knockout stores a tie at its LOWEST place (both beaten semi-finalists are
  // recorded as 4), and a ranking is written at its best: two teams tied for
  // third are both 3rd.
  const shown =
    placement === undefined
      ? undefined
      : (placeSpans(placements).get(placement)?.from ?? placement);
  const run = teamRun(tournament, team.id);
  // Built from the pool, where the arena ids behind the organiser's map names
  // were already resolved, so a minimap opens the same view the tournament's
  // own map grid does.
  const mapLinks = mapPoolIndex(region, tournament.mapPool, tournament.gameModes, tMaps);

  // The meta strip, in the order a reader arriving from the bracket needs it:
  // which tournament, where, when, and what it was played as. Built as a list so
  // an absent one drops out instead of leaving a dangling dot.
  const metaParts = [
    REGION_LABEL[region],
    date(DATE_PATTERN).format(tournament.startAt),
    tournament.gameModes.map((m) => tGame(`tournament-modes.${m}`)).join(", "),
    tierLabel(tournament.tierFrom, tournament.tierTo),
    teamFormat(tournament.minPlayersInTeam),
    // The roster against its cap, the way every other count on the site reads:
    // a 7-player roster in an 8-player format is a team a place short, and
    // "7 players" alone does not say that.
    `${team.players.length}/${tournament.maxPlayersInTeam} players`,
    // The session's own title IS the game server ("EU 2"), which is where a
    // reader has to be at kick-off. A tournament played over several sessions
    // can name more than one, so they are listed rather than assumed to be one.
    [...new Set(tournament.schedule.map((session) => session.title))]
      .filter(Boolean)
      .join(", "),
  ].filter((v): v is string => Boolean(v));

  return (
    <>
      {/* The site's detail-page header: title row, then a dot-separated meta
          strip, the same shape a player, a clan, a map and the tournament above
          this team all open with. */}
      <Panel>
        <PanelContent className="p-0">
          <header className="flex flex-col sm:flex-row sm:items-stretch">
            <div className="flex items-stretch sm:contents">
              {/* The placement in the square the clan page gives an emblem: it
                  is what identifies this team at a glance, the way the emblem
                  identifies a clan, and it was a footnote next to the actions
                  menu before. A team the tournament never placed keeps the
                  generic mark rather than an empty box. */}
              <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-fd-border p-3">
                {shown === undefined ? (
                  <UsersThreeIcon className="size-8 text-fd-muted-foreground" />
                ) : (
                  <>
                    {shown <= 3 && (
                      <RankMedal rank={shown as 1 | 2 | 3} className="h-7" />
                    )}
                    <span
                      className={cn(
                        "font-heading font-bold tabular-nums",
                        shown <= 3 ? "text-sm" : "text-2xl",
                      )}
                    >
                      {ordinal(shown)}
                    </span>
                  </>
                )}
              </div>
            <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-3 px-4 py-3">
              <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight sm:text-4xl">
                {team.title}
              </h1>
              <TournamentActionsMenu
                region={region}
                tournamentId={tournament.id}
                teamId={team.id}
                title={`${team.title} in ${tournament.title}`}
                path={ROUTES.TOURNAMENT_TEAM(region, tournament.id, team.id)}
                // Built by hand rather than through the og tree: this card's
                // path nests a second key under the resource key, which the
                // SDK generator has no shape for, so it is one of its logged
                // exclusions. `UNICUM_API_URL` is the same base the tree's
                // own `.url()` returns.
                ogImage={`${UNICUM_API_URL}/og/${region}/tournaments/${tournament.id}/team/${team.id}`}
              />
            </div>
            {/* One line, scrolled rather than wrapped. The strip holds more
                than the column between the placement square and the ratings can
                show, and wrapping it doubled the header's height; the rail
                keeps it one line and offers the arrow only when there is more
                to reach, the way the tank page's research branch does. */}
            <div className="border-t border-fd-border text-xs text-fd-muted-foreground">
              <ScrollRail
                compact
                className="flex items-center gap-x-2 px-4 py-2 whitespace-nowrap"
              >
                <Link
                  href={ROUTES.TOURNAMENTS(region)}
                  className="shrink-0 hover:text-fd-foreground hover:underline"
                >
                  {t("tournaments")}</Link>
                <span className="shrink-0 text-fd-border">·</span>
                <Link
                  href={ROUTES.TOURNAMENT(region, tournament.id)}
                  className="shrink-0 hover:text-fd-foreground hover:underline"
                >
                  {tournament.title}
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
            {/* Beside the identity, the same slot the player header gives a
                member's clan. A team plays under whatever name its captain
                typed, so this is what says who it actually was, and the count
                says how much of the roster backs that up. */}
            {team.clan && (
              <Link
                href={ROUTES.CLAN(region, team.clan.clanTag)}
                className="flex items-stretch border-t border-fd-border text-sm hover:opacity-80 sm:border-t-0 sm:border-l"
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:flex-none sm:text-right sm:whitespace-nowrap">
                  <div className="truncate">
                    <ClanTag
                      tag={team.clan.clanTag}
                      color={team.clan.clanColor}
                      className="font-semibold"
                    />{" "}
                    {team.clan.clanName && <span>{team.clan.clanName}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("of-players-on-the-day", { members: team.clan.members, length: team.players.length })}</div>
                </div>
                {team.clan.clanEmblem && (
                  <div className="flex size-24 shrink-0 items-center justify-center border-l border-fd-border p-3">
                    <Image
                      src={team.clan.clanEmblem}
                      alt={`${team.clan.clanTag} emblem`}
                      width={195}
                      height={195}
                      className="size-full object-contain"
                    />
                  </div>
                )}
              </Link>
            )}
            {/* Rightmost in the header row, where a clan page carries its own
                averages: they describe the roster, not the draw, so they belong
                to the identity rather than to the result under it. */}
            <TeamMetrics tournament={tournament} team={team} />
            </div>
          </header>
          {/* Under the identity, what the run came to. It sits in the header
              panel rather than a section of its own because it is the answer to
              the page, not a part of it. */}
          <TeamResult
            tournament={tournament}
            run={run}
            place={shown}
            placedTeams={placements.size}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader screenLines={false} className="border-b border-fd-border">
          <PanelTitle>{t("roster", { length: team.players.length })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {roster && roster.length > 0 ? (
            <TeamRosterTable
              region={region}
              players={roster}
              ownerAccountId={team.ownerAccountId}
            />
          ) : (
            <p className="p-4 text-sm text-fd-muted-foreground">
              {t("no-roster-recorded-for-this")}</p>
          )}
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader
          screenLines={false}
          className="border-b border-fd-border"
        >
          <PanelTitle>{t("matches", { length: run.length })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {run.length === 0 ? (
            // Two different situations read identically as an empty list, and
            // telling a team still waiting for its tournament that the draw
            // passed it by is simply wrong. Before kick-off there is nothing to
            // report yet; after it, an empty run is the roster that never made
            // the bracket.
            <p className="p-4 text-sm text-fd-muted-foreground">
              {isTournamentOpen(tournament.status)
                ? t("draw-not-made")
                : t("never-played")}
            </p>
          ) : (
            run.map((m) => (
              <TieBlock
                key={m.uuid}
                match={m}
                region={region}
                tournamentId={tournament.id}
                mapLinks={mapLinks}
              />
            ))
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
