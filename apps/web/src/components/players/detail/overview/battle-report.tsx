"use client";

import type { TranslateFunction } from "@onruntime/translations";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";

/** One line: a label, a value, and whether it breaks down the line above it. */
type Row = { label: string; value: string; under?: boolean; cost?: boolean };

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
  startedAt,
  battleDuration,
  t,
  count,
  time,
}: {
  participant: Participant;
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
    line(t("report.blocked"), own.blocked),
    line(t("report.potential"), own.potential),
    line(t("report.team-damage"), own.teamDamage),
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

  const credits: (Row | null)[] = [
    line(t("report.earned-for-battle"), money.creditsBase),
    line(t("report.reserves"), money.creditsBooster, { under: true }),
    line(t("report.missions"), money.creditsEvent, { under: true }),
    line(t("report.orders"), money.creditsOrder, { under: true }),
    line(t("report.ally-fine"), money.creditsPenalty, { cost: true, under: true }),
    line(t("report.compensation"), money.creditsCompensation, { under: true }),
    line(t("report.subtotal"), money.creditsSubtotal),
    line(t("report.repair"), money.repairCost, { cost: true, under: true }),
    line(t("report.ammo"), money.ammoCost, { cost: true, under: true }),
    line(t("report.supplies"), money.suppliesCost, { cost: true, under: true }),
    line(t("report.total"), money.credits),
  ];

  const experience: (Row | null)[] = [
    line(t("report.earned-for-battle"), money.xpBase),
    line(t("report.reserves"), money.xpBooster, { under: true }),
    line(t("report.missions"), money.xpEvent, { under: true }),
    line(t("report.premium-vehicle"), money.xpPremiumVehicle, { under: true }),
    line(t("report.ally-fine"), money.xpPenalty, { cost: true, under: true }),
    line(t("report.total"), money.xp),
    line(t("report.free-xp"), money.freeXp),
    line(t("report.crew-xp"), money.crewXp),
  ];

  const bonds: (Row | null)[] = [
    line(t("report.earned-for-battle"), money.bondsBase),
    line(t("report.total"), money.bonds),
  ];

  const blocks = [
    { label: t("report.statistics"), rows: statistics },
    { label: t("report.time"), rows: timing },
    { label: t("report.credits"), rows: credits },
    { label: t("report.experience"), rows: experience },
    { label: t("report.bonds"), rows: bonds },
  ];

  return (
    <div className="grid gap-x-8 gap-y-4 px-4 py-3 md:grid-cols-2 xl:grid-cols-3">
      {blocks.map((block) => {
        const rows = block.rows.filter((row): row is Row => row !== null);
        if (rows.length === 0) return null;
        return (
          <div key={block.label} className="min-w-0">
            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
              {block.label}
            </h4>
            <dl className="text-sm">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 py-0.5"
                >
                  <dt
                    className={cn(
                      "truncate",
                      row.under && "text-muted-foreground ps-4",
                    )}
                  >
                    {row.label}
                  </dt>
                  <dd
                    className={cn(
                      "shrink-0 tabular-nums",
                      row.under && "text-muted-foreground",
                      // A cost reads as a cost, which is the one thing a column
                      // of positive numbers cannot say.
                      row.cost && "text-red-500",
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      {money.premium ? (
        <p className="text-muted-foreground text-xs md:col-span-2 xl:col-span-3">
          {t("report.with-premium")}
        </p>
      ) : null}
    </div>
  );
}
