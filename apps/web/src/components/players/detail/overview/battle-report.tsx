"use client";

import type { TranslateFunction } from "@onruntime/translations";
import { BattleLoadout } from "./battle-loadout";
import { ReportBlock, type Block, type Row } from "./battle-report-block";
import type { Participant } from "./battle-types";


/** Two decimals everywhere a mark percentage is shown. See `MARK_PLACES`. */
const MARK_PLACES = 2;

/**
 * "+1.00 % (94.00 -> 95.00)", or "0.00 %" when the battle held the line.
 *
 * Signed on purpose, and the sign is the point: a mark percentage is a figure
 * a player watches move, and an unsigned "1" beside a standing of 95 reads as
 * a second standing rather than as a gain. The previous value is spelled out
 * beside it because the movement is small enough that the reader wants to see
 * both ends of it.
 *
 * Two decimals, like every other mark percentage on the site, even though a
 * battle's own figure arrives as a whole number: the garage reports hundredths
 * and the two are read side by side, so one place rounding to a tenth and the
 * next to a hundredth would look like two different measurements of the same
 * thing.
 */
function moved(delta: number, previous: number): string {
  const sign = delta > 0 ? "+" : "";
  const at = (value: number) => value.toFixed(MARK_PLACES);
  return `${sign}${at(delta)}% (${at(previous)} → ${at(previous + delta)})`;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * What a battle earned this account: the game's own Detailed Report.
 *
 * The same blocks, in the same order, with the same nesting, because a player
 * has read that screen a thousand times and should not be asked to learn a
 * second vocabulary for the same figures. "Direct hits / penetrations" indented
 * under "Shots fired" is the game's shape; three siblings would read as three
 * separate facts.
 *
 * **Only ever about the player whose page this is**, which is why the tab is
 * offered only when they were in the battle. Their statistics are theirs
 * whoever reported it; the Credits, Experience and Bonds blocks are not. The
 * results carry an economy for the reporting client alone, so a battle
 * somebody else uploaded has none for this account at any price, and those
 * three blocks drop out rather than draw a column of zeroes.
 *
 * A figure the client did not send is dropped rather than drawn as zero: the
 * mod sends each only when it is non-zero, so missing means nothing to report,
 * and a battle recorded before the mod carried a field has none of it.
 */
export function BattleReport({
  participant,
  mark,
  startedAt,
  battleDuration,
  t,
  count,
  time,
}: {
  participant: Participant;
  /** Where the mark stood after this battle, and after the one before it. */
  mark: { percent: number; previous: number | null } | null;
  startedAt: string;
  battleDuration: number | null;
  t: TranslateFunction;
  count: Intl.NumberFormat;
  time: { format: (at: string | Date | number) => string };
}) {
  const own = participant.own;
  const money = participant.personal ?? {};
  const survived = own.deathReason === -1;

  const line = (
    label: string,
    value: number | undefined,
    opts: { under?: boolean; cost?: boolean; render?: (v: number) => string } = {},
  ): Row | null =>
    value === undefined
      ? null
      : {
          label,
          value: opts.render
            ? opts.render(value)
            : opts.cost
              ? `-${count.format(value)}`
              : count.format(value),
          under: opts.under,
          cost: opts.cost,
        };

  const pair = (
    label: string,
    a: number | undefined,
    b: number | undefined,
    under?: boolean,
  ): Row | null =>
    a === undefined && b === undefined
      ? null
      : {
          label,
          value: `${count.format(a ?? 0)} / ${count.format(b ?? 0)}`,
          under,
        };

  const statistics: (Row | null)[] = [
    line(t("report.shots"), own.shots),
    pair(t("report.hits-pens"), own.hits, own.piercings, true),
    line(t("report.splash"), own.splash, { under: true }),
    line(t("column.damage"), own.damage),
    line(t("report.sniper"), own.sniper, { under: true }),
    line(t("report.hits-received"), own.hitsReceived),
    line(t("report.pens-received"), own.piercingsReceived, { under: true }),
    line(t("report.bounced"), own.bounced, { under: true }),
    line(t("report.splash-received"), own.splashReceived),
    line(t("report.blocked"), own.blocked),
    line(t("report.potential"), own.potential),
    // Destroyed / hit points, the game's own order for this line.
    pair(t("report.team-damage"), own.teamKills, own.teamDamage),
    line(t("report.spotted"), own.spotted),
    pair(t("report.damaged-destroyed"), own.damaged, own.kills),
    line(
      t("report.assistance"),
      own.radio === undefined && own.track === undefined && own.stun === undefined
        ? undefined
        : (own.radio ?? 0) + (own.track ?? 0) + (own.stun ?? 0),
    ),
    line(t("field.radio"), own.radio, { under: true }),
    line(t("field.track"), own.track, { under: true }),
    line(t("field.stun"), own.stun, { under: true }),
    pair(t("report.capture-defence"), own.capturePoints, own.defended),
    line(t("report.mileage"), own.mileage, {
      render: (v) => `${count.format(Math.round(v / 10) / 100)} km`,
    }),
    line(t("report.repaired"), own.repaired),
    own.health === undefined
      ? null
      : {
          label: t("field.health"),
          value: `${count.format(own.health)} / ${count.format(own.maxHealth ?? 0)}`,
        },
  ];

  const timing: (Row | null)[] = [
    { label: t("report.started"), value: time.format(startedAt) },
    battleDuration
      ? { label: t("report.battle-length"), value: clock(battleDuration) }
      : null,
    own.lifeTime === undefined
      ? null
      : {
          label: survived ? t("report.alive-for") : t("report.destroyed-at"),
          value: clock(own.lifeTime),
        },
  ];

  // The breakdown when the economy is there, the flat total when it is not.
  // The vehicle line always carries what the battle paid and earned, so a
  // report that showed nothing at all until the mod started sending the
  // breakdown would be hiding a figure it has.
  const credits: (Row | null)[] = money.credits === undefined
    ? [line(t("report.credited"), own.credits)]
    : [
    line(t("report.earned-for-battle"), money.creditsBase),
    line(t("report.reserves"), money.creditsBooster, { under: true }),
    line(t("report.missions"), money.creditsEvent, { under: true }),
    line(t("report.orders"), money.creditsOrder, { under: true }),
    line(t("report.wot-plus"), money.creditsWotPlus, { under: true }),
    line(t("report.ally-fine"), money.creditsPenalty, { cost: true, under: true }),
    line(t("report.compensation"), money.creditsCompensation, { under: true }),
    line(t("report.with-bonuses"), money.creditsSubtotal),
    line(t("report.repair"), money.repairCost, { cost: true, under: true }),
    line(t("report.ammo"), money.ammoCost, { cost: true, under: true }),
    line(t("report.supplies"), money.suppliesCost, { cost: true, under: true }),
    line(t("report.credited"), money.credits),
    line(t("report.piggy-bank"), money.piggyBank),
  ];

  // An experience line and the free experience behind it, the game's two
  // columns. Either half can be absent: orders pay only free experience, a
  // premium vehicle only experience.
  const xpLine = (
    label: string,
    xp: number | undefined,
    free: number | undefined,
    opts: { under?: boolean; cost?: boolean } = {},
  ): Row | null =>
    xp === undefined && free === undefined
      ? null
      : {
          label,
          value:
            xp === undefined
              ? ""
              : opts.cost
                ? `-${count.format(xp)}`
                : count.format(xp),
          free: free === undefined ? "" : count.format(free),
          under: opts.under,
          cost: opts.cost,
        };
  // The first victory of the day multiplies both columns, and the game writes
  // the factor rather than a figure. Only when it applied: a factor of one is
  // what every other battle of the day carries.
  const daily = (money.xpDailyFactor ?? 0) > 10 ? money.xpDailyFactor! / 10 : null;
  // Whether the mod sent the free experience line by line. A battle reported
  // before it did has the total alone, which keeps its own line below.
  const freeColumn =
    money.freeXpBase !== undefined || money.freeXpSubtotal !== undefined;

  const experience: (Row | null)[] = money.xp === undefined
    ? [line(t("report.credited"), own.xp)]
    : [
    xpLine(t("report.earned-for-battle"), money.xpBase, money.freeXpBase),
    daily === null
      ? null
      : {
          label: t("report.first-win"),
          value: `×${daily}`,
          free: freeColumn ? `×${daily}` : undefined,
          under: true,
        },
    xpLine(t("report.reserves"), money.xpBooster, money.freeXpBooster, { under: true }),
    xpLine(t("report.missions"), money.xpEvent, money.freeXpEvent, { under: true }),
    xpLine(t("report.orders"), undefined, money.freeXpOrder, { under: true }),
    line(t("report.premium-vehicle"), money.xpPremiumVehicle, { under: true }),
    xpLine(t("report.wot-plus"), money.xpWotPlus, money.freeXpWotPlus, { under: true }),
    line(t("report.ally-fine"), money.xpPenalty, { cost: true, under: true }),
    xpLine(t("report.credited"), money.xp, freeColumn ? money.freeXp : undefined),
    freeColumn ? null : line(t("report.free-xp"), money.freeXp),
    line(t("report.crew-xp"), money.crewXp),
  ];

  const bonds: (Row | null)[] = [
    line(t("report.earned-for-battle"), money.bondsBase),
    line(t("report.credited"), money.bonds),
  ];

  // The mark of excellence, which is the one figure on this screen that is
  // about the tank rather than about the battle. Its own block and not a line
  // among the damage counts, because a reader looking for "did I move" should
  // not have to find it between "shots fired" and "spotted".
  //
  // The movement is shown only when there is a battle before this one to
  // measure against: the game gives the standing and never the gain, so a
  // first battle has a percentage and no arrow. A zero movement is still
  // worth drawing -- a battle that held the line is an answer to the question.
  const marks: (Row | null)[] = mark
    ? [
        {
          label: t("report.mark-of-excellence"),
          value: `${mark.percent.toFixed(MARK_PLACES)}%`,
        },
        mark.previous == null
          ? null
          : {
              label: t("report.mark-movement"),
              value: moved(mark.percent - mark.previous, mark.previous),
              under: true,
            },
      ]
    : [];

  // Two columns that stack on their own, not a grid of rows. In a grid each
  // row is as tall as its tallest block, so the three lines of Time sat beside
  // the whole of Statistics and Experience started under a gap that tall. The
  // battle's own figures on one side, what it took and paid on the other.
  const columns: Block[][] = [
    [
      { label: t("report.statistics"), rows: statistics },
      { label: t("report.marks"), rows: marks },
    ],
    [
      { label: t("report.time"), rows: timing },
      { label: t("report.credits"), rows: credits },
      {
        label: t("report.experience"),
        rows: experience,
        columns: freeColumn
          ? ([t("report.xp-column"), t("report.free-xp-column")] as const)
          : undefined,
      },
      { label: t("report.bonds"), rows: bonds },
    ],
  ];

  return (
    <div className="grid gap-x-8 gap-y-4 px-4 py-3 xl:grid-cols-3">
      {/*
        The figures on the left, the configuration on the right, rather than a
        band of boxes across the top.

        Two things were wrong with the band. It pushed every number below the
        fold on a short panel, and the groups that belong together -- what a
        battle cost and what it paid -- were split across a three-column grid
        by nothing but the order they happened to be declared in. Given a
        column of their own, the money blocks stack and the configuration sits
        beside them, which is also where the loadout boxes want to be: in a
        narrow column they wrap into a stack on their own, with no second
        layout to maintain.

        Three EQUAL columns, and the arithmetic is why it is written this way:
        the outer grid gives thirds, the figures take two of them and split
        that span with the same gap, so each half comes to exactly one third
        as well. A fixed width on the right, which this had, made the third
        column narrower than the two beside it for no reason a reader could
        see.
      */}
      <div className="grid min-w-0 gap-x-8 gap-y-4 md:grid-cols-2 xl:col-span-2">
      {columns.map((column, at) => (
      <div key={at} className="flex min-w-0 flex-col gap-y-4">
      {column.map((block) => (
        <ReportBlock key={block.label} block={block} />
      ))}
      </div>
      ))}
      {/*
        Named, never summed. Each line is a figure the game reports in its own
        right, and they do not form a chain: measured on a real battle, the
        credits came to 43958 without premium, 65937 with it, a repair bill of
        11804, and 75828 actually credited, which is not the subtotal minus the
        bill. Rather than invent a derivation out of the fields the results
        happen to expose, each line says what it is.
      */}
      <p className="text-muted-foreground text-xs md:col-span-2">
        {money.premium ? `${t("report.with-premium")} ` : ""}
        {t("report.not-a-sum")}
      </p>
      </div>

      <BattleLoadout loadouts={participant.loadouts} className="min-w-0" />
    </div>
  );
}
