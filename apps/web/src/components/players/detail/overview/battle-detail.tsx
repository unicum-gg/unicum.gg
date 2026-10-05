"use client";

import useSWR from "swr";
import { useState, type ReactNode } from "react";
import { toRoman } from "roman-numerals";
import {
  CaretDownIcon,
  CaretUpIcon,
  CrosshairSimpleIcon,
  MedalIcon,
  SkullIcon,
  StarIcon,
} from "@phosphor-icons/react";
import {
  RATING_COLOR_CLASS,
  RatingMetric,
  wn7Color,
  wn8Color,
  wnxColor,
  type RatingColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TranslateFunction } from "@onruntime/translations";
import { PlayerName } from "@/components/entity/player-name";
import { SegmentedControl } from "@/components/segmented-control";
import { BattlePlayerPanel } from "./battle-player";
import { BattleReport } from "./battle-report";
import { BattleReplay } from "./battle-replay";
import type {
  BattleDetailData,
  BattleEconomy,
  Participant,
} from "./battle-types";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { unicum } from "@/services/sdk";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const INT = { maximumFractionDigits: 0 } as const;
const SURVIVED = -1;

/**
 * The two text columns are capped and truncate.
 *
 * Two tables share the width, so the columns that can grow without limit are
 * the ones that break the layout: an unbounded vehicle name ran straight into
 * the damage figure beside it. Capping them is what keeps every numeric column
 * on screen, which is the whole point of a roster.
 */
/**
 * The last cell's gutter, on both sides.
 *
 * `last:pe-4` alone gave the rating cell 1rem of padding on the right against
 * the table's own 0.5rem on the left, which is invisible on a transparent cell
 * and plainly lopsided on a coloured one. The rating is the only coloured cell
 * in the table and it is always last, so the fix belongs on the gutter rather
 * than on the colour.
 */
const LAST_GUTTER = "last:ps-4";

const NAME_WIDTH = "w-[11rem] max-w-[11rem]";
const VEHICLE_WIDTH = "w-[10rem] max-w-[10rem]";

const RATING_COLOR: Record<RatingMetric, (value: number) => RatingColor> = {
  [RatingMetric.Wn7]: wn7Color,
  [RatingMetric.Wn8]: wn8Color,
  [RatingMetric.Wnx]: wnxColor,
};

/** Which view of the battle is open, as the game's own results screen names them. */
enum Tab {
  Teams = "teams",
  Report = "report",
  Replay = "replay",
}

/**
 * One column of the roster, which is also one way of asking who did what.
 *
 * A real table with sortable headings, not a list styled like one. The first
 * version was `<ul>` rows with two fixed orders, which is a table that has
 * already decided for the reader: somebody who wants to know who blocked the
 * most, or who lived longest, should be able to ask.
 */
/** Who destroyed whom, both ways round, named. */
export type Kills = {
  /** Whoever destroyed this vehicle, by battle-scoped vehicle id. */
  killerOf: Map<number, string>;
  /** Everyone this vehicle destroyed. */
  victimsOf: Map<number, string[]>;
};

/**
 * Who killed whom, read off `killer` and inverted.
 *
 * The results name the vehicle that destroyed each player, and nothing names
 * the other direction: a player's kill count is a number with no victims
 * attached. Inverting the one map gives the other for free, and "who did this
 * player take out" is the question a kill count actually raises.
 *
 * A bot or an account nobody has looked up here has no name, so it is listed
 * by its vehicle instead: an unnamed killer is still a fact about the battle.
 */
function killsOf(participants: Participant[], unnamed: string): Kills {
  const nameOf = (p: Participant) =>
    p.player?.nickname ?? p.tank?.shortName ?? unnamed;
  const byId = new Map(participants.map((p) => [p.id, p]));
  const killerOf = new Map<number, string>();
  const victimsOf = new Map<number, string[]>();
  for (const p of participants) {
    const killerId = p.own.killer;
    if (!killerId) continue;
    const killer = byId.get(killerId);
    if (!killer) continue;
    killerOf.set(p.id, nameOf(killer));
    const list = victimsOf.get(killerId);
    if (list) list.push(nameOf(p));
    else victimsOf.set(killerId, [nameOf(p)]);
  }
  return { killerOf, victimsOf };
}

type Column = {
  id: string;
  /** What the tooltip says. The heading itself is usually the icon. */
  label: string;
  /** Drawn as the heading, with `label` as its tooltip. Words where absent. */
  icon?: ReactNode;
  /** Pulled out of a participant, for the sort and for the cell. */
  value: (p: Participant, metric: RatingMetric) => number | null;
  /** How it is drawn, when a plain number is not it. */
  render?: (value: number) => string;
  /** What hovering the CELL says, when the figure has names behind it. */
  tip?: (p: Participant, kills: Kills) => string | null;
  className?: string;
};

function duration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * A whole battle: both teams, named and rated, and the player's own line.
 *
 * **The roster opens ordered by what each player's battle scored, not by
 * damage.** Damage says who farmed: a heavy that soaked a flank and a scout
 * that lit it are not comparable on that column, and the biggest number on the
 * board is routinely the player who did the least with the most. The rating is
 * each vehicle measured against what that vehicle is expected to do, so the
 * opening order answers the question a reader actually has. Every other column
 * is one click away, which is the part a fixed order cannot offer.
 *
 * Names come from this site's own players table, rendered by the site's one
 * naming component, so a supporter or a tournament winner wears their crest
 * here exactly as they do on a leaderboard. They are here by default rather
 * than behind anything: these accounts are already ours to resolve.
 */
export function BattleDetail({
  region,
  battleId,
  startedAt,
  duration: cardDuration,
  personal,
  arenaId,
  mapImage,
  mapBounds,
  metric,
  highlightAccount,
}: {
  region: Region;
  battleId: string;
  /** The arena, its minimap and its extent, for the replay viewer. */
  arenaId: string;
  mapImage: string | null;
  mapBounds: {
    bottomLeft: { x: number; z: number };
    upperRight: { x: number; z: number };
  } | null;
  /** The battle's own start, which the card already holds. */
  startedAt: string;
  duration: number | null;
  /**
   * What the battle earned the player whose page this is, or null.
   *
   * Decides whether the detailed report is offered: the results carry an
   * economy for the reporting client alone, so a battle somebody else uploaded
   * has none of it for this account at any price.
   */
  personal: BattleEconomy | null;
  metric: RatingMetric;
  /** The player whose page this is, so their own row stands out. */
  highlightAccount?: number;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const { num, date } = useFormat();
  const count = num(INT);
  // The battle's own start, to the second: the game's Detailed Report opens on
  // it, and two battles in an evening are told apart by the clock.
  const time = date("HH:mm:ss");
  // The row a reader has opened, by its battle-scoped vehicle id.
  const [opened, setOpened] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>(Tab.Teams);
  // Experience, which is how the game's own results screen orders a team: it
  // is the one figure that already folds damage, assists, defence and the win
  // together, and a reader arriving from the end-of-battle screen finds the
  // same order here. Every other column is one click away.
  const [sort, setSort] = useState<{ id: string; desc: boolean }>({
    id: "xp",
    desc: true,
  });

  const request = () => unicum.region(region).battles(battleId).detail();
  const { data, isLoading, error } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as BattleDetailData),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-muted-foreground px-4 py-4 text-sm">
        {t("detail-unavailable")}
      </p>
    );
  }

  /**
   * The columns the game's own results screen carries, in its order.
   *
   * Damage, kills, experience, medals: that is what a player reads after a
   * battle, and the roster has no business inventing a different vocabulary
   * for the same screen. Assists, blocked and the rest are real but they are
   * the second question, and they live in the player's own tab where there is
   * room to name them. Our rating is the one column the game has no equivalent
   * for, so it goes last, where the game puts its own score.
   *
   * Headings are icons with tooltips rather than words, which is what lets two
   * teams sit side by side at all: a word column is four times the width of
   * the number under it.
   */
  const columns: Column[] = [
    {
      id: "damage",
      label: t("column.damage"),
      icon: <CrosshairSimpleIcon className="size-4" weight="bold" />,
      value: (p) => p.own.damage ?? 0,
      className: "w-16",
    },
    {
      id: "kills",
      label: t("column.kills"),
      icon: <SkullIcon className="size-4" weight="fill" />,
      value: (p) => p.own.kills ?? 0,
      // A kill count with no victims is a number; this is what it means.
      tip: (p, kills) => {
        const victims = kills.victimsOf.get(p.id);
        return victims?.length ? victims.join(", ") : null;
      },
      className: "w-10",
    },
    {
      id: "xp",
      label: t("column.xp"),
      icon: <StarIcon className="size-4" weight="fill" />,
      value: (p) => p.own.xp ?? 0,
      className: "w-14",
    },
    {
      id: "medals",
      label: t("column.medals"),
      icon: <MedalIcon className="size-4" weight="fill" />,
      // Not collected yet: the mod reads the results' `achievements` but did
      // not send them, so every battle already stored has none. The column is
      // here so it fills on its own as new battles arrive rather than being
      // bolted on later.
      value: (p) => (p.medals ? p.medals.length : null),
      className: "w-10 hidden sm:table-cell",
    },
    {
      id: "rating",
      label: metric.toUpperCase(),
      value: (p, m) => {
        const value = p.rating[m];
        return typeof value === "number" ? value : null;
      },
      className: "w-14",
    },
  ];

  const kills = killsOf(data.participants, t("unnamed"));
  const teams = [...new Set(data.participants.map((p) => p.team))].sort();
  // The page's own player, when they were in this battle: the report is about
  // them and nobody else.
  const mine = highlightAccount
    ? (data.participants.find((p) => p.account === highlightAccount) ?? null)
    : null;
  const open = data.participants.find((p) => p.id === opened) ?? null;
  const killer =
    open && open.own.killer
      ? (data.participants.find((p) => p.id === open.own.killer) ?? null)
      : null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="bg-background/40 border-border/40 border-t">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          {/* Only offered where it can be whole: the detailed report is about
              this account's own battle, and the economy half of it exists only
              when this account's own client reported it. */}
          {mine ? (
            <SegmentedControl
              active={tab}
              onSelect={setTab}
              segments={[
                { id: Tab.Teams, label: t("tab.teams") },
                { id: Tab.Report, label: t("tab.report") },
                { id: Tab.Replay, label: t("tab.replay") },
              ]}
            />
          ) : (
            <span />
          )}
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
            <span>{t("battle-length", { length: duration(data.duration) })}</span>
            {data.server ? <span>{data.server}</span> : null}
            {data.clientVersion ? <span>{data.clientVersion}</span> : null}
            {/* Nobody else publishes this: how many clients told us about it. */}
            <span>{t("reported-by", { count: data.reporters })}</span>
          </span>
        </div>

        {tab === Tab.Replay && mine ? (
          <BattleReplay
            battleId={battleId}
            arenaId={arenaId}
            mapImage={mapImage}
            bounds={mapBounds}
            participants={data.participants}
            highlightAccount={highlightAccount}
            t={t}
          />
        ) : tab === Tab.Report && mine ? (
          <BattleReport
            participant={{ ...mine, personal }}
            startedAt={startedAt}
            battleDuration={data.duration ?? cardDuration}
            t={t}
            count={count}
            time={time}
          />
        ) : (
          <>

        {/*
          Side by side from `lg`, because the two teams ARE the comparison:
          reading one and then scrolling to the other loses it.

          Opening a player replaces the OTHER team's half with their panel,
          which is what the game's own results screen does. The table being
          read stays exactly where it is, so the row that was clicked does not
          move out from under the cursor.
        */}
        <div className="divide-border/40 divide-y lg:grid lg:grid-cols-2 lg:gap-px lg:divide-y-0">
          {teams.map((team) =>
            open && open.team !== team ? (
              <BattlePlayerPanel
                key={team}
                region={region}
                participant={open}
                killer={killer}
                victims={kills.victimsOf.get(open.id) ?? []}
                metric={metric}
                startedAt={startedAt}
                battleDuration={data.duration}
                onClose={() => setOpened(null)}
                t={t}
                count={count}
                time={time}
              />
            ) : (
              <TeamTable
                key={team}
                region={region}
                team={team}
                won={data.winnerTeam === team}
                lost={
                  data.winnerTeam !== null &&
                  data.winnerTeam !== 0 &&
                  data.winnerTeam !== team
                }
                participants={data.participants.filter((p) => p.team === team)}
                columns={columns}
                kills={kills}
                metric={metric}
                sort={sort}
                onSort={setSort}
                count={count}
                highlightAccount={highlightAccount}
                opened={opened}
                onOpen={(id) => setOpened(id === opened ? null : id)}
                t={t}
              />
            ),
          )}
        </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function TeamTable({
  region,
  team,
  won,
  lost,
  participants,
  columns,
  kills,
  metric,
  sort,
  onSort,
  count,
  highlightAccount,
  opened,
  onOpen,
  t,
}: {
  region: Region;
  team: number;
  won: boolean;
  lost: boolean;
  participants: Participant[];
  columns: Column[];
  kills: Kills;
  metric: RatingMetric;
  sort: { id: string; desc: boolean };
  onSort: (next: { id: string; desc: boolean }) => void;
  count: Intl.NumberFormat;
  highlightAccount?: number;
  /** The row a reader has opened, by battle-scoped vehicle id. */
  opened: number | null;
  onOpen: (id: number) => void;
  t: TranslateFunction;
}) {
  const column = columns.find((c) => c.id === sort.id) ?? columns[0];
  const rows = [...participants].sort((a, b) => {
    const va = column.value(a, metric);
    const vb = column.value(b, metric);
    // A row with no value for this column sorts last either way: it is the one
    // we know least about, and it should never head the list.
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return sort.desc ? vb - va : va - vb;
  });
  const totals = {
    kills: participants.reduce((sum, p) => sum + (p.own.kills ?? 0), 0),
    damage: participants.reduce((sum, p) => sum + (p.own.damage ?? 0), 0),
  };

  // The gutter lives in the cells, not on a wrapper. A wrapper would inset the
  // rows themselves, so every horizontal rule would stop short of the panel's
  // edges; putting it on the first and last cell leaves the rules running the
  // full width while the content still clears the edge. The repo's own cells
  // carry `first:ps-0` and lean on a `--page-padding` that resolves to nothing
  // this deep in a panel, which is why it has to be said here.
  const gutter = cn("first:ps-4 last:pe-4", LAST_GUTTER);

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "flex items-baseline justify-between gap-2 px-4 pt-2 text-xs font-medium",
          won && "text-emerald-500",
          lost && "text-red-500",
        )}
      >
        <span>
          {t("team", { team })}
          {won ? ` · ${t("outcome-won")}` : ""}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {t("team-totals", {
            kills: totals.kills,
            damage: count.format(totals.damage),
          })}
        </span>
      </div>
      {/* A size down from the page's own: two rosters share the width, and at
          the default size the vehicle names were truncating on most rows. The
          figures are tabular either way. */}
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className={cn(gutter, NAME_WIDTH)}>
              {t("column.player")}
            </TableHead>
            <TableHead className={VEHICLE_WIDTH}>
              {t("column.vehicle")}
            </TableHead>
            {columns.map((c) => {
              const active = sort.id === c.id;
              return (
                <TableHead
                  key={c.id}
                  className={cn("text-end", gutter, c.className)}
                  // On the column header, which is what carries the role, not
                  // on the button inside it.
                  aria-sort={
                    active ? (sort.desc ? "descending" : "ascending") : "none"
                  }
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() =>
                          onSort({ id: c.id, desc: active ? !sort.desc : true })
                        }
                        className={cn(
                          "hover:text-foreground inline-flex w-full items-center justify-end gap-0.5",
                          active && "text-foreground",
                        )}
                      >
                        {/* An icon heading says nothing on its own, so the
                            tooltip is not a nicety here: it is the column
                            name. A `title` attribute was, and it took a
                            second of hover to appear and read as a browser
                            artefact. */}
                        {c.icon ?? c.label}
                        {active ? (
                          sort.desc ? (
                            <CaretDownIcon className="size-3" />
                          ) : (
                            <CaretUpIcon className="size-3" />
                          )
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {c.label}
                      {active ? null : ` · ${t("sort-by")}`}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow
              key={p.id}
              onClick={() => onOpen(p.id)}
              aria-selected={p.id === opened}
              className={cn(
                "hover:bg-foreground/5 cursor-pointer transition-colors",
                // Destroyed, said the way the game says it: the whole line
                // dims. An icon in the name column was a glyph to learn and a
                // column of width to pay for; a dimmed row is read without
                // being looked at. Set on the row so every cell inherits it,
                // and the rating cell keeps its own colour because a `<td>`
                // that declares one never inherits.
                p.own.deathReason !== SURVIVED && "text-muted-foreground",
                p.account !== undefined &&
                  p.account === highlightAccount &&
                  "bg-primary/10",
                p.id === opened && "bg-foreground/10",
              )}
            >
              <TableCell className={cn(gutter, NAME_WIDTH)}>
                <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                  {p.player ? (
                    // The site's one format for naming a player, given a
                    // deliberately thin identity: the name and the clan, and
                    // none of the crests. `PlayerName` renders every honour it
                    // is handed, which is exactly right on a leaderboard and
                    // wrong on thirty rows at once, where fourteen crests say
                    // nothing about the battle and crowd the names they sit
                    // beside. The panel gets the whole identity, because there
                    // the reader asked about one player.
                    //
                    // The link is off for the same reason: the row is the
                    // target, and sixty link targets across two rosters is
                    // something a reader has to steer around while scanning.
                    <NameWithKiller
                      region={region}
                      player={p.player}
                      killer={kills.killerOf.get(p.id) ?? null}
                      t={t}
                    />
                  ) : (
                    <span className="text-muted-foreground italic">
                      {t("unnamed")}
                    </span>
                  )}
                </span>
              </TableCell>
              {/* Its own column, as the game's own results screen gives it:
                  squeezed beside the name it lost the one thing a reader
                  wants from it, which is the vehicle's name. */}
              <TableCell className={VEHICLE_WIDTH}>
                {p.tank ? (
                  <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                    <VehicleTypeIcon type={p.tank.type} />
                    <span className="text-fd-muted-foreground text-xs">
                      {toRoman(p.tank.tier)}
                    </span>
                    <TankIcon
                      region={region}
                      tag={p.tank.tag}
                      type={p.tank.type}
                      className="h-3 w-auto shrink-0 object-contain"
                    />
                    <span className="truncate">
                      {p.tank.shortName || p.tank.name}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">
                    {t("unknown-vehicle")}
                  </span>
                )}
              </TableCell>
              {columns.map((c) => {
                const value = c.value(p, metric);
                const rated = c.id === "rating" && value !== null;
                return (
                  <TableCell
                    key={c.id}
                    className={cn(
                      "text-end tabular-nums",
                      gutter,
                      // The colour belongs to the CELL, not to a pill inside
                      // it: `RATING_COLOR_CLASS` is a background, and on a span
                      // it paints a lozenge that stops short of the cell's own
                      // edges. Every rating table in this repo puts it here.
                      rated &&
                        cn(
                          "font-medium",
                          RATING_COLOR_CLASS[RATING_COLOR[metric](value)],
                        ),
                      c.className,
                    )}
                  >
                    <CellValue
                      value={value}
                      render={c.render}
                      count={count}
                      tip={c.tip ? c.tip(p, kills) : null}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * A name, and what hovering it says about how their battle ended.
 *
 * The dimmed row already says they were destroyed; this says by whom, which is
 * the question the dimming raises and cannot answer. On the name rather than in
 * a column of its own, because a column wide enough for a nickname is a column
 * the two rosters do not have between them.
 */
function NameWithKiller({
  region,
  player,
  killer,
  t,
}: {
  region: Region;
  player: NonNullable<Participant["player"]>;
  killer: string | null;
  t: TranslateFunction;
}) {
  // A deliberately thin identity: the name and the clan, none of the crests.
  // `PlayerName` renders every honour it is handed, which is right on a
  // leaderboard and wrong on thirty rows at once. The panel gets the whole one.
  const name = (
    <PlayerName
      region={region}
      player={{
        nickname: player.nickname,
        clanTag: player.clanTag,
        clanColor: player.clanColor,
      }}
      // The row is the click target; sixty link targets across two rosters is
      // something a reader has to steer around while scanning.
      link={false}
      className="min-w-0"
      linkClassName="truncate"
    />
  );
  if (!killer) return name;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="min-w-0">{name}</span>
      </TooltipTrigger>
      <TooltipContent>{t("destroyed-by", { nickname: killer })}</TooltipContent>
    </Tooltip>
  );
}

/** A figure, and the names behind it when it has any. */
function CellValue({
  value,
  render,
  count,
  tip,
}: {
  value: number | null;
  render?: (value: number) => string;
  count: Intl.NumberFormat;
  tip: string | null;
}) {
  if (value === null) {
    return <span className="text-muted-foreground">&mdash;</span>;
  }
  const shown = render ? render(value) : count.format(value);
  if (!tip) return <>{shown}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted underline-offset-2">
          {shown}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
