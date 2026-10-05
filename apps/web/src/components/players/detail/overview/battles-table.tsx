"use client";

import { Fragment, useState } from "react";
import { toRoman } from "roman-numerals";
import {
  CaretDownIcon,
  CrosshairSimpleIcon,
  EyeIcon,
  HandshakeIcon,
  ShieldIcon,
  SkullIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import {
  gameplayLabel,
  minimapUrl,
  modeLabel,
  RATING_COLOR_CLASS,
  RatingMetric,
  wn7Color,
  wn8Color,
  wnxColor,
  type RatingColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import Link from "@/components/link";
import { mapName } from "@/components/game-name";
import { MinimapImage } from "@/components/maps/minimap-image";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import ROUTES from "@/constants/routes";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BattleDetail } from "./battle-detail";
import type { BattleEconomy } from "./battle-types";

const INT = { maximumFractionDigits: 0 } as const;
// The battle's own start, to the minute: two battles in an evening are told
// apart by the time, not the day.
const DATE_PATTERN = "d MMM, HH:mm";

/** What the endpoint hands over, as these cards read it. */
export type PlayerBattleRow = {
  id: string;
  startedAt: string;
  map: string;
  /** The minimap the arena is played on, resolved server-side. */
  mapImage: string | null;
  /** The arena's extent in metres, which places a replay on that image. */
  mapBounds: {
    bottomLeft: { x: number; z: number };
    upperRight: { x: number; z: number };
  } | null;
  gameplay: string | null;
  battleType: number;
  duration: number | null;
  team: number;
  outcome: "win" | "loss" | "draw" | "unknown";
  tank: {
    id: number;
    name: string;
    shortName: string;
    tier: number;
    type: string;
    nation: string;
    tag: string;
    slug: string | null;
  } | null;
  own: {
    damage: number;
    radio: number;
    track: number;
    stun: number;
    blocked: number;
    spotted: number;
    kills: number;
    xp: number;
    deathReason: number;
  };
  rating: Partial<Record<string, number | null>>;
  players: number;
  reporters: number;
  /**
   * What the battle earned this player, when their own client reported it.
   *
   * Null otherwise, which is what decides whether the detailed report tab is
   * offered at all: the results carry an economy for the reporting client
   * alone.
   */
  personal: BattleEconomy | null;
};

/** What `deathReason` says when nobody killed them. Not 0: 0 is a real reason. */
const SURVIVED = -1;

const RATING_COLOR: Record<RatingMetric, (value: number) => RatingColor> = {
  [RatingMetric.Wn7]: wn7Color,
  [RatingMetric.Wn8]: wn8Color,
  [RatingMetric.Wnx]: wnxColor,
};

/** How long the battle lasted, as the game shows it: `5:44`. */
function clock(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * One card a battle, newest first.
 *
 * **A card rather than a table row, and the reason is the outcome.** A list of
 * battles is read for its shape before any single figure in it: a bad evening
 * is six red cards, and that has to arrive before the eye picks a column. A
 * table can only say it in one cell, so the reader parses ten rows to learn
 * something a tint says at a glance. The tint is deliberately strong enough to
 * read on a dark ground from across the page, which a 5% wash is not.
 *
 * The map is its own minimap, filling the card's height, with the name over it.
 * A player recognises the ground instantly and reads the name second, which is
 * the opposite of what a text cell offers, and the images are already on the
 * mirror the map pages use.
 *
 * The figures carry icons instead of a header row, in two rows of two. That is
 * what lets the card reflow on a phone without losing which number is which,
 * and it is why there is no `<table>` here: a six-column table at 400px either
 * scrolls sideways or lies.
 */
export function PlayerBattlesTable({
  region,
  nickname,
  metric,
  accountId,
  battles,
}: {
  region: Region;
  nickname: string;
  metric: RatingMetric;
  /** Whose page this is, so their own row stands out in the roster. */
  accountId: number;
  battles: PlayerBattleRow[];
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const { t: tMaps } = useTranslation("game/maps");
  const { num, date } = useFormat();
  const count = num(INT);
  const when = date(DATE_PATTERN);
  // One at a time. Two open rosters is sixty rows and no longer a list.
  const [open, setOpen] = useState<string | null>(null);

  return (
    <TooltipProvider delayDuration={150}>
    <ul className="divide-border/40 divide-y">
      {battles.map((battle) => {
        const assisted = battle.own.radio + battle.own.track + battle.own.stun;
        const survived = battle.own.deathReason === SURVIVED;
        const rating = battle.rating[metric];
        const title = mapName(battle.map, battle.map, tMaps);
        const mode = modeLabel(battle.battleType);
        // Not beside Onslaught, where `comp7` is the mode saying itself twice.
        const play =
          mode === null || battle.gameplay === "comp7"
            ? null
            : gameplayLabel(battle.gameplay);
        const length = clock(battle.duration);
        const expanded = open === battle.id;
        return (
          <li
            key={battle.id}
            className={cn(
              battle.outcome === "win" && "bg-emerald-500/10",
              battle.outcome === "loss" && "bg-red-500/10",
              battle.outcome === "draw" && "bg-muted/40",
            )}
          >
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setOpen(expanded ? null : battle.id)}
            className="hover:bg-foreground/5 flex w-full items-stretch gap-3 pe-3 ps-0 text-start transition-colors"
          >
            {/* The result as a full-height rail: it reads straight down the
                list, and it costs no column. */}
            <span
              aria-hidden
              className={cn(
                "w-1 shrink-0",
                battle.outcome === "win" && "bg-emerald-500",
                battle.outcome === "loss" && "bg-red-500",
                (battle.outcome === "draw" || battle.outcome === "unknown") &&
                  "bg-muted-foreground/40",
              )}
            />

            {/* The map, with its own name over it. The gradient is what keeps
                the name legible over ground that is pale in one corner and
                dark in the next. */}
            <span className="relative my-2 h-14 w-28 shrink-0 overflow-hidden rounded sm:w-36">
              <MinimapImage
                // The catalogue's answer when it has one: an Onslaught night
                // arena ships a daylight image under its own name, so deriving
                // the url from the id drew the wrong map.
                src={battle.mapImage ?? minimapUrl(battle.map)}
                arenaId={battle.map}
                alt={title}
                sizes="144px"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <span className="absolute inset-x-1.5 bottom-1 flex items-end justify-between gap-1">
                <span className="truncate text-xs font-medium text-white drop-shadow">
                  {title}
                </span>
                {length ? (
                  <span className="shrink-0 text-[10px] text-white/70 tabular-nums">
                    {length}
                  </span>
                ) : null}
              </span>
            </span>

            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {battle.tank ? (
                  <>
                    <VehicleTypeIcon type={battle.tank.type} />
                    <span className="text-fd-muted-foreground text-xs">
                      {toRoman(battle.tank.tier)}
                    </span>
                    <TankIcon
                      region={region}
                      tag={battle.tank.tag}
                      type={battle.tank.type}
                      className="h-3.5 w-auto shrink-0 object-contain"
                    />
                    {battle.tank.slug ? (
                      <Link
                        // This player on this vehicle, like the profile's other
                        // vehicle lists: the row is one battle of their record.
                        href={ROUTES.PLAYER_TANK(
                          region,
                          nickname,
                          battle.tank.slug,
                        )}
                        className="truncate font-medium hover:underline"
                      >
                        {battle.tank.shortName || battle.tank.name}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">
                        {battle.tank.shortName || battle.tank.name}
                      </span>
                    )}
                    {survived ? null : (
                      <SkullIcon
                        className="text-muted-foreground size-3.5 shrink-0"
                        weight="fill"
                        aria-label={t("died")}
                      />
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground truncate">
                    {t("unknown-vehicle")}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                {/* Which queue it came from, and what the teams were doing in
                    it. Two independent facts: a random battle is Standard,
                    Encounter or Assault depending on the arena, and the card
                    said neither. Unnamed modes show nothing rather than a
                    number, which would be the site showing its plumbing. */}
                {mode ? (
                  <span className="text-foreground font-medium">{mode}</span>
                ) : null}
                {play ? <span>{play}</span> : null}
                <span>{when.format(battle.startedAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <UsersThreeIcon className="size-3" weight="fill" />
                  {battle.players}
                </span>
                {/* Nobody else publishes this, and it is the honest answer to
                    "where did this row come from". Only worth a word when more
                    than one client saw it. */}
                {battle.reporters > 1 ? (
                  <span>{t("seen-by", { count: battle.reporters })}</span>
                ) : null}
              </span>
            </span>

            {/* Two rows of two rather than one row of four: it halves the width
                the figures need, which is what makes room for the map on a
                narrow screen. */}
            <span className="grid shrink-0 grid-cols-2 items-center gap-x-3 gap-y-0.5 self-center sm:gap-x-5">
              <Figure
                icon={<CrosshairSimpleIcon className="size-3.5" weight="bold" />}
                label={t("column.damage")}
                value={count.format(battle.own.damage)}
              />
              <Figure
                icon={<HandshakeIcon className="size-3.5" weight="fill" />}
                label={t("column.assisted")}
                value={count.format(assisted)}
                muted
              />
              <Figure
                icon={<ShieldIcon className="size-3.5" weight="fill" />}
                label={t("column.blocked")}
                value={count.format(battle.own.blocked)}
                muted
              />
              <Figure
                icon={<EyeIcon className="size-3.5" weight="fill" />}
                label={t("column.spotted")}
                value={String(battle.own.spotted)}
                muted
              />
            </span>

            {/* The one number that says whether the battle was any good, in the
                bands the site uses everywhere else. A dash rather than a zero
                for a vehicle the expected values do not carry. */}
            <span className="flex w-16 shrink-0 items-center justify-end self-center">
              {typeof rating === "number" ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-sm font-semibold tabular-nums",
                    "bg-foreground/5",
                    RATING_COLOR_CLASS[RATING_COLOR[metric](rating)],
                  )}
                  title={t("rating-title", { metric: metric.toUpperCase() })}
                >
                  {count.format(rating)}
                </span>
              ) : (
                <span className="text-muted-foreground">&mdash;</span>
              )}
            </span>

            <CaretDownIcon
              aria-hidden
              className={cn(
                "text-muted-foreground size-4 shrink-0 self-center transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>

          {/* Fetched only once opened: a roster is thirty rows and most cards
              are never opened. */}
          {expanded ? (
            <BattleDetail
              region={region}
              battleId={battle.id}
              startedAt={battle.startedAt}
              duration={battle.duration}
              personal={battle.personal}
              arenaId={battle.map}
              mapImage={battle.mapImage}
              mapBounds={battle.mapBounds}
              metric={metric}
              highlightAccount={accountId}
            />
          ) : null}
          </li>
        );
      })}
    </ul>
    </TooltipProvider>
  );
}

/**
 * One figure with its icon, which is what replaces a column heading.
 *
 * The icon carries no meaning on its own, so the tooltip is the label rather
 * than a nicety. A `title` attribute was doing this job and doing it badly:
 * a second of hover, the browser's own styling, and nothing at all on a
 * touch screen.
 */
function Figure({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-end gap-1 text-sm tabular-nums",
            muted ? "text-muted-foreground" : "font-medium",
          )}
        >
          <span aria-hidden className="opacity-50">
            {icon}
          </span>
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
