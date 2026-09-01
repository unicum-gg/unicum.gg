"use client";

import { Fragment, useMemo } from "react";

import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollRail } from "@/components/scroll-rail";
import { cn } from "@/lib/utils";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import ROUTES from "@/constants/routes";
import { BracketType, type Region } from "@unicum.gg/wargaming";
import type { RatingMetric } from "@unicum.gg/shared";
import type {
  TournamentGroup,
  TournamentMatch,
  TournamentStage,
  TournamentTeam,
} from "./record";
import { ClanTag } from "@/components/entity/clan-tag";
import {
  clansByTeam,
  ratingColor,
  ratingsByTeam,
  useRatingMetric,
} from "./team-rating";
import {
  CARD_H,
  CARD_W,
  COL_GAP,
  layoutBracket,
  roundLabel,
} from "./layout";
import { splitMapLabels } from "./team-run";

const DASH = "—";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** A team's name, or null for a bracket slot that has not been filled yet. */
function name(teamNames: Map<number, string>, id: number | null): string | null {
  return id === null ? null : (teamNames.get(id) ?? null);
}

/** Same, for the clan: absent covers an unfilled slot and a team whose roster
 * was too mixed to attribute. */
function clanOf(
  teamClans: Map<number, { tag: string; color: string | null }>,
  id: number | null,
): { tag: string; color: string | null } | null {
  return id === null ? null : (teamClans.get(id) ?? null);
}

/** Same, for the rating: absent covers both an unfilled slot and a roster we
 * hold no stats on. */
function rating(
  teamRatings: Map<number, number>,
  id: number | null,
): number | null {
  return id === null ? null : (teamRatings.get(id) ?? null);
}

/** One side of a tie. The winner is bold, the loser muted, and a slot the
 * bracket has drawn but not filled reads as awaiting rather than as a team.
 *
 * The name links to that team's page, which is where the bracket stops being a
 * result and becomes something to read: its roster, its run, and the side it
 * started on for every map. A slot with no team yet has nothing to open. */
function Side({
  region,
  tournamentId,
  teamId,
  name,
  clan,
  rating,
  metric,
  score,
  won,
  decided,
}: {
  region: Region;
  tournamentId: number;
  teamId: number | null;
  name: string | null;
  /** The clan behind this side, when one was resolved. */
  clan: { tag: string; color: string | null } | null;
  /** The team's average rating, or null for an unfilled slot and for a roster
   * we hold no stats on. */
  rating: number | null;
  metric: RatingMetric;
  score: number | null;
  won: boolean;
  decided: boolean;
}) {
  const label = (
    <span
      className={cn(
        // No `truncate` here: this span is inline inside the link below, where
        // it has nothing to overflow against. The clipping belongs to whichever
        // element is the flex item, so it is applied on both branches instead.
        "text-xs",
        !name && "text-fd-muted-foreground italic",
        decided && (won ? "font-semibold text-fd-foreground" : "text-fd-muted-foreground"),
      )}
    >
      {name ?? "TBD"}
      {/* Inside the truncating label, so a long name gives way to it rather
          than pushing it out of the card. */}
      {clan && (
        <>
          {" "}
          <ClanTag
            tag={clan.tag}
            color={clan.color}
            className="font-mono text-[10px]"
          />
        </>
      )}
    </span>
  );
  return (
    // The winner carries a brand accent bar and a tint, not just bold text:
    // weight alone is the difference between two greys on a dark card, and the
    // one thing a reader scans a bracket for is who went through. The losing row
    // keeps a transparent bar of the same width so the two stay aligned.
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-l-2 px-2 py-1",
        decided && won
          ? "border-brand bg-brand/5"
          : "border-transparent",
      )}
    >
      {teamId !== null && name ? (
        <Link
          href={ROUTES.TOURNAMENT_TEAM(region, tournamentId, teamId)}
          className="min-w-0 truncate hover:underline"
        >
          {label}
        </Link>
      ) : (
        <span className="min-w-0 truncate">{label}</span>
      )}
      {/* The same coloured chip the tables paint, so a tie reads as a matchup
          and not just as two names: the whole question in front of a bracket is
          who was favoured, and the answer is already mirrored per roster.
          `leading-none` keeps it inside the row's own height, which CARD_H is
          measured from. */}
      {rating !== null && (
        <span
          className={cn(
            "ml-auto shrink-0 rounded-xs px-1 py-0.5 text-[10px] leading-none font-semibold tabular-nums",
            ratingColor(rating, metric),
          )}
        >
          {intFmt.format(rating)}
        </span>
      )}
      <span
        className={cn(
          "w-3 shrink-0 text-right text-xs tabular-nums",
          decided && won
            ? "font-semibold text-fd-foreground"
            : "text-fd-muted-foreground",
        )}
      >
        {score ?? DASH}
      </span>
    </div>
  );
}

/** The maps a tie was played on, each linking to its page when the tournament's
 * pool resolved it. The pool is the only thing that can: the match names its
 * maps in prose, and the arena ids behind those names live there. */
function MatchMaps({
  maps,
  mapLinks,
}: {
  maps: string | null;
  mapLinks: Map<string, string>;
}) {
  const labels = splitMapLabels(maps);
  if (labels.length === 0) return "\u00a0";
  return (
    <>
      <MapPinIcon className="size-2.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {labels.map((label, i) => {
          const href = mapLinks.get(label.toLowerCase());
          return (
            <Fragment key={`${label}:${i}`}>
              {i > 0 && ", "}
              {href ? (
                <Link href={href} className="hover:text-brand hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </Fragment>
          );
        })}
      </span>
    </>
  );
}

function MatchCard({
  region,
  tournamentId,
  match,
  teamNames,
  teamRatings,
  teamClans,
  metric,
  mapLinks,
}: {
  region: Region;
  tournamentId: number;
  match: TournamentMatch;
  teamNames: Map<number, string>;
  teamRatings: Map<number, number>;
  teamClans: Map<number, { tag: string; color: string | null }>;
  metric: RatingMetric;
  mapLinks: Map<string, string>;
}) {
  const decided = match.winnerTeamId !== null;
  // Exactly the height the layout placed it at (`h-full` of a CARD_H box), and
  // opaque: the cards sit over the connector lines, so a transparent one would
  // have a line running through its middle. The maps row is pushed to the
  // bottom so a match without one keeps the same two-row rhythm as its
  // neighbours instead of shrinking off its own connector.
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-sm border border-fd-border bg-fd-background">
      <Side
        region={region}
        tournamentId={tournamentId}
        teamId={match.team1Id}
        name={name(teamNames, match.team1Id)}
        clan={clanOf(teamClans, match.team1Id)}
        rating={rating(teamRatings, match.team1Id)}
        metric={metric}
        score={match.winsTeam1}
        won={decided && match.winnerTeamId === match.team1Id}
        decided={decided}
      />
      <div className="border-t border-fd-border" />
      <Side
        region={region}
        tournamentId={tournamentId}
        teamId={match.team2Id}
        name={name(teamNames, match.team2Id)}
        clan={clanOf(teamClans, match.team2Id)}
        rating={rating(teamRatings, match.team2Id)}
        metric={metric}
        score={match.winsTeam2}
        won={decided && match.winnerTeamId === match.team2Id}
        decided={decided}
      />
      {/* Tinted and icon-led so it reads as the card's footer rather than as a
          third team: the two rows above are a name and a score, and without a
          break the map list sat in the same rhythm and looked like one. */}
      <div className="mt-auto flex items-center gap-1 truncate border-t border-fd-border bg-fd-secondary/40 px-2 py-1 text-[10px] text-fd-muted-foreground">
        <MatchMaps maps={match.maps} mapLinks={mapLinks} />
      </div>
    </div>
  );
}

/**
 * A knockout bracket drawn as the tree it is.
 *
 * The cards are absolutely positioned from {@link layoutBracket}, not stacked in
 * flex columns, because a readable bracket needs each tie level with the two it
 * came from, and that position is an average of its feeders rather than an
 * index. The connectors are one SVG behind the cards: an elbow per edge, drawn
 * from the coordinates the layout already produced.
 */
function KnockoutBracket({
  region,
  tournamentId,
  group,
  bracket,
  teamNames,
  teamRatings,
  teamClans,
  metric,
  mapLinks,
}: {
  region: Region;
  tournamentId: number;
  group: TournamentGroup;
  bracket: BracketType;
  teamNames: Map<number, string>;
  teamRatings: Map<number, number>;
  teamClans: Map<number, { tag: string; color: string | null }>;
  metric: RatingMetric;
  mapLinks: Map<string, string>;
}) {
  const layout = useMemo(
    () => layoutBracket(group.matches, bracket),
    [group.matches, bracket],
  );
  if (layout.placed.length === 0) return null;

  const HEADER_H = 28;

  return (
    // On the rail like the tech tree: a 145-team draw is nine columns wide and
    // the reader has to reach the final. On a tall bracket the native scrollbar
    // sits a screen below the cards, so the arrow is the only affordance that is
    // where the eye already is.
    <ScrollRail stickyButtons className="p-4">
      <div
        className="relative"
        style={{ width: layout.width, height: layout.height + HEADER_H }}
      >
        {layout.columns.map((col) => (
          <h4
            key={col.round}
            className="absolute text-xs font-semibold tracking-wide text-fd-muted-foreground uppercase"
            style={{ left: col.x, top: 0, width: CARD_W }}
          >
            {roundLabel(col.round, bracket)}
          </h4>
        ))}
        {/* Behind the cards, and inert: the lines are structure, not content, so
            they never intercept a click or reach a screen reader. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={layout.width}
          height={layout.height + HEADER_H}
          aria-hidden="true"
        >
          {layout.edges.map(({ from, to }) => {
            const x1 = from.x + CARD_W;
            const y1 = from.y + HEADER_H + CARD_H / 2;
            const x2 = to.x;
            const y2 = to.y + HEADER_H + CARD_H / 2;
            const mid = x1 + COL_GAP / 2;
            return (
              <polyline
                key={`${from.match.uuid}->${to.match.uuid}`}
                points={`${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                className="text-fd-border"
              />
            );
          })}
        </svg>
        {layout.placed.map((p) => (
          <div
            key={p.match.uuid}
            className="absolute"
            style={{
              left: p.x,
              top: p.y + HEADER_H,
              width: CARD_W,
              height: CARD_H,
            }}
          >
            <MatchCard
              region={region}
              tournamentId={tournamentId}
              match={p.match}
              teamNames={teamNames}
              teamRatings={teamRatings}
              teamClans={teamClans}
              metric={metric}
              mapLinks={mapLinks}
            />
          </div>
        ))}
      </div>
    </ScrollRail>
  );
}

/** A round-robin table: the standings are the result, and the matches behind
 * them are the working. */
function GroupTable({
  region,
  tournamentId,
  group,
  teamNames,
}: {
  region: Region;
  tournamentId: number;
  group: TournamentGroup;
  teamNames: Map<number, string>;
}) {
  const rows = group.standings
    .slice()
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  return (
    // Full width, with the TEAM column absorbing the slack: the counters then
    // land where every other table on the site puts its numbers, hard against
    // the right edge, and the row rules still close the panel. Capping the
    // table instead left those rules stopping mid-panel, which reads as a
    // missing border rather than as the end of the table.
    <Table className="my-0! [&_td]:py-1.5! [&_th]:py-2! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[1%] text-end">#</TableHead>
          <TableHead className="w-full">Team</TableHead>
          <TableHead className="w-[1%] text-end">W</TableHead>
          <TableHead className="w-[1%] text-end">L</TableHead>
          <TableHead className="w-[1%] text-end">D</TableHead>
          <TableHead className="w-[1%] text-end">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.teamId}>
            <TableCell className="text-end tabular-nums text-fd-muted-foreground">
              {s.position ?? DASH}
            </TableCell>
            <TableCell className="truncate">
              <Link
                href={ROUTES.TOURNAMENT_TEAM(region, tournamentId, s.teamId)}
                className="hover:underline"
              >
                {name(teamNames, s.teamId) ?? DASH}
              </Link>
            </TableCell>
            {/* Won green, lost red, the same reading the player table gives a
                signed figure: a standings row is scanned, not read, and the
                colour is what makes it answer at a glance. A zero stays neutral
                (no wins is not a good result, and no losses is not a bad one),
                and draws never carry a colour since they are neither. */}
            <TableCell
              className={cn(
                "text-end tabular-nums",
                s.wins > 0 && "text-emerald-500",
              )}
            >
              {s.wins}
            </TableCell>
            <TableCell
              className={cn(
                "text-end tabular-nums",
                s.losses > 0 && "text-red-500",
              )}
            >
              {s.losses}
            </TableCell>
            <TableCell className="text-end tabular-nums">{s.draws}</TableCell>
            <TableCell className="text-end font-medium tabular-nums">
              {s.points ?? DASH}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * How the tournament was played, stage by stage.
 *
 * A round robin is shown as its table, because that is what decides it. Anything
 * knocked out is shown as its tree, because a placement there is the round a
 * team went out in and the table would only repeat it. A double elimination
 * records no placement at all, which is the other reason its tree is the answer.
 */
export function TournamentBracket({
  region,
  tournamentId,
  stages,
  teams,
  mapLinks,
}: {
  region: Region;
  tournamentId: number;
  stages: TournamentStage[];
  /** The entrants, from which the name and rating of each side are looked up: a
   * tie names its sides by team id only. */
  teams: TournamentTeam[];
  /** Map name (lowercased) to the page it opens, from the tournament's own
   * pool. A tie names its maps in prose, so this is what makes them links. */
  mapLinks: Map<string, string>;
}) {
  const metric = useRatingMetric();
  const teamNames = useMemo(
    () => new Map(teams.map((team) => [team.id, team.title])),
    [teams],
  );
  const teamRatings = useMemo(
    () => ratingsByTeam(teams, metric),
    [teams, metric],
  );
  const teamClans = useMemo(() => clansByTeam(teams), [teams]);
  if (stages.length === 0) return null;
  // Flattened first so the panels have ONE running index across every stage.
  // Each draws its own bottom line and only the first draws a top one: two
  // adjacent panels sit flush, so `screen-line-after` and `screen-line-before`
  // land on the same pixel and stack two 10% washes into a rule twice as dark
  // as every other divider on the page.
  const panels = stages.flatMap((stage) =>
    stage.groups.map((group) => ({ stage, group })),
  );
  return (
    <>
      {panels.map(({ stage, group }, i) => (
          <Panel
            key={`${stage.id}:${group.id}`}
            screenLines={false}
            className={cn("screen-line-after", i === 0 && "screen-line-before")}
          >
            <PanelHeader
              screenLines={false}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
            >
              <PanelTitle>
                {stage.title}
                {stage.groups.length > 1 && ` — Group ${group.order}`}
              </PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                {group.teamsCount} teams
                {stage.winnersPerGroup > 0 &&
                  `, top ${stage.winnersPerGroup} advance`}
              </span>
            </PanelHeader>
            <PanelContent className="p-0">
              {stage.bracketType === BracketType.RoundRobin ? (
                <GroupTable
                  region={region}
                  tournamentId={tournamentId}
                  group={group}
                  teamNames={teamNames}
                />
              ) : (
                <KnockoutBracket
                  region={region}
                  tournamentId={tournamentId}
                  group={group}
                  bracket={stage.bracketType}
                  teamNames={teamNames}
                  teamRatings={teamRatings}
                  teamClans={teamClans}
                  metric={metric}
                  mapLinks={mapLinks}
                />
              )}
            </PanelContent>
          </Panel>
      ))}
    </>
  );
}
