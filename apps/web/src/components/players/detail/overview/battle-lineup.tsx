"use client";

import { SkullIcon } from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import type { TranslateFunction } from "@onruntime/translations";
import type { Region } from "@unicum.gg/wargaming";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** What `deathReason` says when nobody killed them. Not 0: 0 is a real reason. */
const SURVIVED = -1;

/**
 * One tank of a vehicle that fought in several, as the endpoints hand it over.
 *
 * Frontline lets a player respawn in another tank, and the results carry one
 * record per tank. The row's own `tank` is then only the first of them, while
 * its figures are the whole battle: this is what says which tank did what.
 */
export type LineupTank = {
  tank: {
    tier: number;
    type: string;
    tag: string;
    name: string;
    shortName: string;
  } | null;
  damage: number;
  radio: number;
  track: number;
  stun: number;
  kills: number;
  xp: number;
  lifeTime: number;
  deathReason: number;
};

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

function TankLabel({
  region,
  tank,
  t,
}: {
  region: Region;
  tank: LineupTank["tank"];
  t: TranslateFunction;
}) {
  if (!tank) {
    return (
      <span className="text-muted-foreground truncate italic">
        {t("unknown-vehicle")}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <VehicleTypeIcon type={tank.type} />
      <span className="text-muted-foreground text-xs">{toRoman(tank.tier)}</span>
      <TankIcon
        region={region}
        tag={tank.tag}
        type={tank.type}
        className="h-3 w-auto shrink-0 object-contain"
      />
      <span className="truncate">{tank.shortName || tank.name}</span>
    </span>
  );
}

/**
 * "+2" beside the first tank's name, naming the others on hover.
 *
 * Nothing at all for a vehicle that kept one tank, which is every battle
 * outside the respawn modes. Needs a `TooltipProvider` above it, which both
 * the battle list and the roster already have.
 */
export function LineupMore({
  region,
  lineup,
  t,
  count,
}: {
  region: Region;
  lineup?: LineupTank[];
  t: TranslateFunction;
  count: Intl.NumberFormat;
}) {
  if (!lineup || lineup.length < 2) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground bg-muted shrink-0 rounded px-1 text-[10px] font-medium tabular-nums">
          {t("lineup.more", { count: lineup.length - 1 })}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="mb-1 font-medium">
          {t("lineup.hint", { count: lineup.length })}
        </p>
        <ul className="space-y-0.5">
          {lineup.map((one, at) => (
            <li key={at} className="flex items-center justify-between gap-3">
              <TankLabel region={region} tank={one.tank} t={t} />
              <span className="shrink-0 tabular-nums">
                {count.format(one.damage)}
              </span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * What each tank did, as the game's own Frontline report breaks it down.
 *
 * A block of the player panel, beside the figures it splits: the panel's
 * totals are the whole battle, and this is the only place they are told apart.
 */
export function LineupBreakdown({
  region,
  lineup,
  t,
  count,
}: {
  region: Region;
  lineup?: LineupTank[];
  t: TranslateFunction;
  count: Intl.NumberFormat;
}) {
  if (!lineup || lineup.length < 2) return null;
  return (
    <div>
      <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {t("lineup.heading")}
      </h4>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th className="py-0.5 text-start font-normal" />
            <th className="py-0.5 text-end font-normal">{t("column.damage")}</th>
            <th className="py-0.5 text-end font-normal">
              {t("report.assistance")}
            </th>
            <th className="py-0.5 text-end font-normal">{t("lineup.kills")}</th>
            <th className="py-0.5 text-end font-normal">{t("report.xp")}</th>
            <th className="py-0.5 text-end font-normal">{t("lineup.time")}</th>
          </tr>
        </thead>
        <tbody>
          {lineup.map((one, at) => (
            <tr key={at}>
              <td className="max-w-0 py-0.5 pe-2">
                <span className="flex min-w-0 items-center gap-1">
                  <TankLabel region={region} tank={one.tank} t={t} />
                  {one.deathReason === SURVIVED ? null : (
                    <SkullIcon
                      className="text-muted-foreground size-3 shrink-0"
                      weight="fill"
                      aria-label={t("died")}
                    />
                  )}
                </span>
              </td>
              <td className="py-0.5 ps-2 text-end tabular-nums">
                {count.format(one.damage)}
              </td>
              <td className="py-0.5 ps-2 text-end tabular-nums">
                {count.format(one.radio + one.track + one.stun)}
              </td>
              <td className="py-0.5 ps-2 text-end tabular-nums">
                {count.format(one.kills)}
              </td>
              <td className="py-0.5 ps-2 text-end tabular-nums">
                {count.format(one.xp)}
              </td>
              <td className="py-0.5 ps-2 text-end tabular-nums">
                {clock(one.lifeTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
