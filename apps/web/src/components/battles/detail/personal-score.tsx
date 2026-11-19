import type { ReactNode } from "react";
import Image from "next/image";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import {
  mapFinishReasonOf,
  MapFinishReason,
  minimapUrl,
} from "@unicum.gg/shared";
import type {
  BattleDetail,
  BattleParticipant,
  BattleRecording,
} from "@unicum.gg/core/battles/read";
import type { BattleMedal } from "@/services/battles/medals";
import { masteryBadgeName } from "@/components/game-name";
import { Hint } from "@/components/hint";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { MinimapImage } from "@/components/maps/minimap-image";
import { PlayerName } from "@/components/entity/player-name";
import { MoMIcon } from "@/components/tanks/mom-icon";
import { TankIcon } from "@/components/tanks/tank-icon";
import { dateFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { cn } from "@/lib/utils";
import { BattlePerformance } from "./performance";
import { ReplayStats } from "./replay-stats";

/** How the battle ended for the recorder. */
function outcome(
  battle: BattleDetail,
  team: number,
): "win" | "loss" | "draw" | null {
  if (battle.winnerTeam === null) return null;
  if (battle.winnerTeam === 0) return "draw";
  return battle.winnerTeam === team ? "win" : "loss";
}

/**
 * One recording, from its recorder's side: what the game's results screen
 * tells a player when the battle ends (the result, what it awarded, what they
 * earned, what they did to each enemy), drawn with the site's own parts. The
 * header is a battle row of a player's list, larger; the figures are the
 * detailed report's blocks.
 *
 * Everything here is either the recorder's line of the battle or what their
 * own results carried in the file, which is why it exists for a recorder and
 * nobody else.
 */
export async function personalScore({
  locale,
  region,
  battle,
  player,
  recording,
  map,
}: {
  locale: string;
  region: Region;
  battle: BattleDetail & { medals?: Record<string, BattleMedal> };
  player: BattleParticipant;
  recording: BattleRecording;
  /** The map's name in the reader's language. */
  map: string;
}): Promise<{ header: ReactNode; awards: ReactNode; performance: ReactNode }> {
  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/battles/detail/personal-score", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  const own = player.own;
  const result = outcome(battle, player.team);
  const ending = mapFinishReasonOf(battle.finishReason);
  const killer = own.killer
    ? battle.participants.find((one) => one.id === own.killer)
    : undefined;
  const mastery = recording.markOfMastery;
  const medals = (player.medals ?? [])
    .map((id) => battle.medals?.[String(id)])
    .filter((medal): medal is BattleMedal => Boolean(medal));
  const destroyed = own.deathReason !== undefined && own.deathReason >= 0;

  // A battle row of a player's list, larger: the rail and the tint say the
  // result before anything is read.
  const header = (
    <div
      className={cn(
        "border-border/40 flex border-b",
        result === "win" && "bg-emerald-500/10",
        result === "loss" && "bg-red-500/10",
        result === "draw" && "bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0",
          result === "win" && "bg-emerald-500",
          result === "loss" && "bg-red-500",
          (result === "draw" || result === null) && "bg-muted-foreground/40",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <span className="relative h-28 w-full shrink-0 overflow-hidden rounded sm:w-56">
          <MinimapImage
            src={battle.mapImage ?? minimapUrl(battle.map)}
            arenaId={battle.map}
            alt={map}
            sizes="224px"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <span className="absolute inset-x-2 bottom-1.5 truncate text-sm font-medium text-white drop-shadow">
            {map}
          </span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {result ? (
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span
                className={cn(
                  "text-2xl font-semibold",
                  result === "win" && "text-emerald-500",
                  result === "loss" && "text-red-500",
                )}
              >
                {t(`result.${result}`)}
              </span>
              {result !== "draw" && ending !== MapFinishReason.Other ? (
                <span className="text-muted-foreground text-sm">
                  {t(`ending.${ending}.${result}`)}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PlayerName region={region} player={player.player!} />
            {player.tank ? (
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  {toRoman(player.tank.tier)}
                </span>
                <TankIcon
                  region={region}
                  tag={player.tank.tag}
                  type={player.tank.type}
                  nation={player.tank.nation}
                  className="h-4 w-auto"
                />
                {player.tank.shortName || player.tank.name}
              </span>
            ) : null}
          </div>
          <span className="text-muted-foreground text-xs">
            {dateFormat(locale, "d MMM yyyy, HH:mm").format(battle.startedAt)}
            {" · "}
            {destroyed ? (
              killer?.player ? (
                <>
                  {t("destroyed-by-label")}{" "}
                  <Link
                    href={ROUTES.PLAYER(region, killer.player.nickname)}
                    prefetch={false}
                    className="text-foreground hover:underline"
                  >
                    {killer.player.nickname}
                  </Link>
                </>
              ) : (
                t("destroyed")
              )
            ) : (
              t("survived")
            )}
          </span>
        </div>

        <ReplayStats
          region={region}
          battleId={battle.id}
          recorder={recording.accountId}
          clientVersion={battle.clientVersion}
          views={recording.views}
          downloads={recording.downloads}
        />
      </div>
    </div>
  );

  // What the battle awarded, on one line of equal-height tiles: the mastery
  // badge and the medals, as the profile's cabinet pictures them. The rating
  // is the player panel's, beside this.
  const awards =
    mastery > 0 || medals.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        {mastery > 0 ? (
          <Hint
            as="span"
            content={masteryBadgeName(mastery as 1 | 2 | 3 | 4, tGame)}
            className="flex size-12 items-center justify-center"
          >
            <MoMIcon mastery={mastery as 1 | 2 | 3 | 4} className="size-10" />
          </Hint>
        ) : null}
        {medals.map((medal) => (
          <Hint
            key={medal.key}
            as="span"
            content={medal.name}
            className="flex size-12 items-center justify-center"
          >
            <Image
              src={medal.image}
              // Wargaming's catalogue picks the host, so it is not run
              // through the optimiser's allow-list.
              unoptimized
              alt={medal.name}
              width={48}
              height={48}
              className="size-12 object-contain"
            />
          </Hint>
        ))}
      </div>
    ) : null;

  const performance = (
    <BattlePerformance
      locale={locale}
      region={region}
      battle={battle}
      player={player}
      details={recording.details}
    />
  );

  return { header, awards, performance };
}
