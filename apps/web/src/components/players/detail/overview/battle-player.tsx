"use client";

import { XIcon } from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import type { TranslateFunction } from "@onruntime/translations";
import {
  RATING_COLOR_CLASS,
  RatingMetric,
  wn7Color,
  wn8Color,
  wnxColor,
  type RatingColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import Link from "@/components/link";
import { PlayerName } from "@/components/entity/player-name";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";

const RATING_COLOR: Record<RatingMetric, (value: number) => RatingColor> = {
  [RatingMetric.Wn7]: wn7Color,
  [RatingMetric.Wn8]: wn8Color,
  [RatingMetric.Wnx]: wnxColor,
};

/** What `deathReason` says when nobody killed them. Not 0: 0 is a real reason. */
const SURVIVED = -1;

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/** One line of the report: a label, a value, and whether it is a sub-line. */
type Row = { label: string; value: string; under?: boolean };

/**
 * One player's battle, laid out as the game's own Detailed Report.
 *
 * **The same blocks, in the same order, with the same nesting**, because a
 * player has read that screen a thousand times and should not have to learn a
 * second vocabulary for the same numbers. "Hits received" with penetrations and
 * non-penetrations indented under it is the game's shape, and a flat list of
 * three siblings would say something slightly different.
 *
 * What is missing, and why: the game's Credits, Experience and Bonds blocks are
 * built from `personal.<vehicle>`, which the results carry for the reporting
 * client ALONE. The other twenty-nine players have no economy in the payload at
 * all, at any price, so those blocks would be empty for 29 rows out of 30. The
 * totals that do exist for everyone are shown here instead.
 *
 * Figures the client did not send are dropped rather than drawn as zero: the
 * mod sends each only when it is non-zero, so a missing one means nothing to
 * report, and a battle recorded before the mod carried a field has none of it.
 *
 * **This is where the links live, and the roster has none.** A roster row is
 * read, compared and sorted; opening one player is the moment somebody asked
 * for them, and that is the moment to offer their profile and their record on
 * the vehicle they brought.
 */
export function BattlePlayerPanel({
  region,
  participant,
  killer,
  metric,
  startedAt,
  battleDuration,
  onClose,
  t,
  count,
  time,
}: {
  region: Region;
  participant: Participant;
  /** Whoever destroyed them, when the battle named one. */
  killer: Participant | null;
  metric: RatingMetric;
  /** The battle's own start, for the Time block. */
  startedAt: string;
  battleDuration: number | null;
  onClose: () => void;
  t: TranslateFunction;
  count: Intl.NumberFormat;
  time: { format: (at: string | Date | number) => string };
}) {
  const { own, tank, player } = participant;
  const rating = participant.rating[metric];
  const survived = own.deathReason === SURVIVED;

  /** A line, dropped entirely when the client said nothing about it. */
  const line = (
    label: string,
    value: number | undefined,
    render?: (v: number) => string,
    under?: boolean,
  ): Row | null =>
    value === undefined
      ? null
      : {
          label,
          value: render ? render(value) : count.format(value),
          under,
        };

  /** `a/b`, dropped when neither half was reported. */
  const pair = (
    label: string,
    a: number | undefined,
    b: number | undefined,
    under?: boolean,
  ): Row | null =>
    a === undefined && b === undefined
      ? null
      : { label, value: `${count.format(a ?? 0)} / ${count.format(b ?? 0)}`, under };

  const statistics: (Row | null)[] = [
    line(t("report.shots"), own.shots),
    pair(t("report.hits-pens"), own.hits, own.piercings, true),
    line(t("report.splash"), own.splash, undefined, true),
    line(t("column.damage"), own.damage),
    line(t("report.sniper"), own.sniper, undefined, true),
    line(t("report.hits-received"), own.hitsReceived),
    line(t("report.pens-received"), own.piercingsReceived, undefined, true),
    line(t("report.bounced"), own.bounced, undefined, true),
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
    line(t("field.radio"), own.radio, undefined, true),
    line(t("field.track"), own.track, undefined, true),
    line(t("field.stun"), own.stun, undefined, true),
    pair(t("report.capture-defence"), own.capturePoints, own.defended),
    line(t("report.mileage"), own.mileage, (v) =>
      `${count.format(Math.round(v / 10) / 100)} km`,
    ),
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

  const earned: (Row | null)[] = [
    line(t("report.xp"), own.xp),
    line(t("report.credits"), own.credits),
    own.health === undefined
      ? null
      : {
          label: t("field.health"),
          value: `${count.format(own.health)} / ${count.format(own.maxHealth ?? 0)}`,
        },
  ];

  const blocks: { label: string; rows: (Row | null)[] }[] = [
    { label: t("report.statistics"), rows: statistics },
    { label: t("report.time"), rows: timing },
    { label: t("report.earned"), rows: earned },
  ];

  return (
    <div className="bg-muted/30 flex min-w-0 flex-col">
      <div className="flex items-start justify-between gap-2 px-4 pt-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {player ? (
              <PlayerName region={region} player={player} className="min-w-0" />
            ) : (
              <span className="text-muted-foreground italic">
                {t("unnamed")}
              </span>
            )}
            {typeof rating === "number" ? (
              <span
                className={cn(
                  "rounded px-1.5 text-sm font-semibold tabular-nums",
                  RATING_COLOR_CLASS[RATING_COLOR[metric](rating)],
                )}
              >
                {count.format(rating)}
              </span>
            ) : null}
          </div>
          {tank ? (
            <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
              <VehicleTypeIcon type={tank.type} />
              <span className="text-xs">{toRoman(tank.tier)}</span>
              <TankIcon
                region={region}
                tag={tank.tag}
                type={tank.type}
                className="h-3 w-auto shrink-0 object-contain"
              />
              {tank.slug && player ? (
                // This player's own record on this vehicle, which is the
                // question a roster raises and cannot answer.
                <Link
                  href={ROUTES.PLAYER_TANK(region, player.nickname, tank.slug)}
                  className="text-foreground truncate hover:underline"
                >
                  {tank.name}
                </Link>
              ) : (
                <span className="text-foreground truncate">{tank.name}</span>
              )}
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {survived
              ? t("survived-the-battle")
              : killer?.player
                ? t("destroyed-by", { nickname: killer.player.nickname })
                : t("destroyed")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("close")}
          className="shrink-0"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="space-y-3 px-4 py-3">
        {blocks.map((block) => {
          const rows = block.rows.filter((row): row is Row => row !== null);
          if (rows.length === 0) return null;
          return (
            <div key={block.label}>
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
                        // Indented under the figure it breaks down, as the
                        // game indents them: three siblings would read as
                        // three separate facts.
                        row.under ? "text-muted-foreground ps-4" : "",
                      )}
                    >
                      {row.label}
                    </dt>
                    <dd
                      className={cn(
                        "shrink-0 tabular-nums",
                        row.under && "text-muted-foreground",
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
      </div>
    </div>
  );
}
