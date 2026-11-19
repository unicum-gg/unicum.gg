import {
  CrosshairIcon,
  EyeIcon,
  HandshakeIcon,
  LightningIcon,
  ShieldIcon,
  SkullIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import type { BattleEnemyDetail } from "@unicum.gg/shared";
import type { BattleDetail, BattleParticipant } from "@unicum.gg/core/battles/read";
import { PlayerName } from "@/components/entity/player-name";
import { Hint } from "@/components/hint";
import Link from "@/components/link";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { cn } from "@/lib/utils";

/** The game's "battle performance" marks, in the order its results screen
 * draws them, each with what it reads off a detail. */
const MARKS: {
  key: string;
  icon: Icon;
  value: (detail: BattleEnemyDetail) => number | boolean;
}[] = [
  { key: "spotted", icon: EyeIcon, value: (d) => d.spotted },
  { key: "assisted", icon: HandshakeIcon, value: (d) => d.assisted },
  { key: "crits", icon: WrenchIcon, value: (d) => d.crits },
  { key: "damaged", icon: CrosshairIcon, value: (d) => d.damageDealt },
  { key: "blocked", icon: ShieldIcon, value: (d) => d.blocked ?? 0 },
  { key: "stunned", icon: LightningIcon, value: (d) => d.stuns ?? 0 },
  { key: "killed", icon: SkullIcon, value: (d) => d.killed },
];

/** A mark's reading of one detail as a number: an amount, or 1 for a yes. */
const amount = (raw: number | boolean): number =>
  typeof raw === "number" ? raw : raw ? 1 : 0;

/**
 * The game's "battle performance": what the recorder did to each enemy, as a
 * table drawn like the battle's own rosters (the player, the vehicle, then a
 * column per mark, each headed by its total). Read from the recorder's results
 * in the file, the only place it exists.
 */
export async function BattlePerformance({
  locale,
  region,
  battle,
  player,
  details,
}: {
  locale: string;
  region: Region;
  battle: BattleDetail;
  player: BattleParticipant;
  details: BattleEnemyDetail[];
}) {
  if (details.length === 0) return null;
  const { t } = await getTranslation("components/battles/detail/personal-score", locale);
  const count = numberFormat(locale);
  const byVehicle = new Map(details.map((detail) => [detail.vehicle, detail]));
  // Every enemy: one they never touched is part of the picture too. The ones
  // they did something to first, the most damaged first.
  const enemies = battle.participants
    .filter((one) => one.team !== player.team)
    .sort(
      (a, b) =>
        (byVehicle.get(b.id)?.damageDealt ?? -1) - (byVehicle.get(a.id)?.damageDealt ?? -1),
    );
  const enemyDetails = enemies.flatMap((one) => byVehicle.get(one.id) ?? []);
  // A column nobody could have lit (no stun from a tank that cannot stun) is
  // left out rather than drawn empty all the way down.
  const shown = MARKS.filter(
    (mark) => mark.key !== "stunned" || enemyDetails.some((detail) => (detail.stuns ?? 0) > 0),
  );

  return (
    <div className="min-w-0">
      <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {t("performance")}
      </h4>
      {/* The generic table keeps a prose margin above and below it, which
          left a strip of empty panel under the heading. */}
      <Table className="my-0! text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-0">{t("column.player")}</TableHead>
            <TableHead>{t("column.vehicle")}</TableHead>
            {shown.map(({ key, icon: MarkIcon, value }) => (
              <TableHead key={key} className="w-12 px-0 last:pe-0">
                {/* The column's total over the enemies: a sum for an amount,
                    a count of enemies for a yes-or-no mark. */}
                <Hint
                  as="span"
                  content={t(`mark-hint.${key}`)}
                  className="flex flex-col items-center gap-0.5 py-1"
                >
                  <MarkIcon className="size-4" aria-label={t(`mark-label.${key}`)} />
                  <span className="text-foreground text-[10px] font-semibold tabular-nums">
                    {count.format(
                      enemyDetails.reduce((sum, detail) => sum + amount(value(detail)), 0),
                    )}
                  </span>
                </Hint>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {enemies.map((enemy) => {
            const detail = byVehicle.get(enemy.id);
            const dead = (enemy.own.deathReason ?? -1) >= 0;
            return (
              <TableRow
                key={enemy.id}
                // Destroyed, said the way the rosters say it: the line dims.
                className={cn(dead && "text-muted-foreground")}
              >
                <TableCell className="max-w-[9rem] ps-0">
                  {enemy.player ? (
                    // Name and clan only, like a roster row: a crest on every
                    // line would crowd the names and say nothing about the
                    // battle.
                    <PlayerName
                      region={region}
                      player={{
                        nickname: enemy.player.nickname,
                        clanTag: enemy.player.clanTag,
                        clanColor: enemy.player.clanColor,
                      }}
                      linkClassName="truncate"
                    />
                  ) : (
                    <span className="text-muted-foreground italic">{t("unnamed")}</span>
                  )}
                </TableCell>
                <TableCell>
                  {enemy.tank ? (
                    <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                      <VehicleTypeIcon type={enemy.tank.type} />
                      <span className="text-fd-muted-foreground w-5 shrink-0 text-xs">
                        {toRoman(enemy.tank.tier)}
                      </span>
                      <TankIcon
                        region={region}
                        tag={enemy.tank.tag}
                        type={enemy.tank.type}
                        nation={enemy.tank.nation}
                        className="h-3 w-auto shrink-0 object-contain"
                      />
                      {enemy.tank.slug && enemy.player ? (
                        <Link
                          // This player on this vehicle, like the battle lists;
                          // an event vehicle has no record, so the vehicle.
                          href={
                            enemy.tank.isEvent
                              ? ROUTES.TANK(region, enemy.tank.slug)
                              : ROUTES.PLAYER_TANK(region, enemy.player.nickname, enemy.tank.slug)
                          }
                          prefetch={false}
                          className="truncate hover:underline"
                        >
                          {enemy.tank.shortName || enemy.tank.name}
                        </Link>
                      ) : (
                        <span className="truncate">{enemy.tank.shortName || enemy.tank.name}</span>
                      )}
                    </span>
                  ) : null}
                </TableCell>
                {shown.map(({ key, icon: MarkIcon, value }) => {
                  // The header carries the icon: a line carries the amount,
                  // or the icon alone for a yes-or-no mark that happened,
                  // and nothing for what did not.
                  const raw = detail ? value(detail) : false;
                  const on = amount(raw) > 0;
                  return (
                    <TableCell key={key} className="w-12 px-0 text-center tabular-nums last:pe-0">
                      {on ? (
                        <Hint
                          as="span"
                          content={
                            typeof raw === "number"
                              ? `${t(`mark-label.${key}`)}: ${count.format(raw)}`
                              : t(`mark-label.${key}`)
                          }
                          className="inline-flex justify-center"
                        >
                          {typeof raw === "number" ? (
                            count.format(raw)
                          ) : (
                            <MarkIcon className="size-3.5" weight="fill" />
                          )}
                        </Hint>
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
