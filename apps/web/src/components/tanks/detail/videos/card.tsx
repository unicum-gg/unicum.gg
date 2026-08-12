"use client";

import Image from "next/image";
import {
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type BattleFormat,
  type BattleResult,
  type MapGameMode,
  type SpawnDirection,
} from "@unicum.gg/shared";
import { PlayIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Region } from "@unicum.gg/wargaming";
import { ClanTag } from "@/components/entity/clan-tag";
import ROUTES from "@/constants/routes";
import type { TankVideoGroup } from "./group";
import { BattleRow, Thumbnail } from "./card-parts";
import { PublishedDate } from "./published-date";
import { useTankVideoPlayer } from "./player";
import { BATTLE_PARAM } from "./battle-param";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";

/** One published battle. Shaped like what the endpoint returns rather than
 * importing the server type, so this stays a client component. */
export type TankVideoCardData = {
  id: number;
  videoId: string;
  startSeconds: number;
  title: string;
  channelName: string;
  mapName: string | null;
  mode: MapGameMode | null;
  /** The compass side, derived from the map's own geometry, and its label. The
   * raw value is what a filter matches on; the label is what a row reads. */
  direction?: SpawnDirection | null;
  directionLabel: string | null;
  result: BattleResult | null;
  combinedDamage: number | null;
  /** When the video went up on YouTube. Null when the page did not answer at
   * submission time. */
  publishedAt?: Date | string | null;
  gameVersion: string | null;
  /** The map's own page, where a tactic is looked up. */
  mapSlug?: string | null;
  /** What was being played. Everything but `random` makes this a tactic: the
   * video is about the ground and the side rather than about a vehicle. */
  format?: BattleFormat;
  /** Players per team and the tier the battle was fought at, which is not the
   * vehicle's tier below: a skirmish is fought at a tier of its own. */
  teamSize?: number | null;
  tier?: number | null;
  /** The clan it was played for, when one was credited. */
  clan?: {
    region: string;
    id: number;
    tag: string;
    name: string;
    color: string | null;
    emblem: string | null;
  } | null;
  /** The tank a battle was played in. Absent on that tank's own page, where
   * every row is the same vehicle and saying so would be noise, and present on
   * the community index, which crosses tanks. */
  tankName?: string | null;
  tankSlug?: string | null;
  tankShortName?: string | null;
  tankTag?: string | null;
  vehicleTier?: number | null;
  nation?: string | null;
  type?: string | null;
  isPremium?: boolean;
  /** Set on the submitter's own rows that a moderator has not settled yet. */
  pending?: boolean;
};

/**
 * A video and the battles marked in it, each opening at its own second.
 *
 * On a tank's own page a click hands the battle to the hero, which plays it at
 * the size a battle is worth watching at rather than in a third of a grid row.
 * Anywhere else, where there is no hero to hand it to, the card is a link to
 * that tank's page, opening on the battle clicked.
 *
 * It never embeds a player of its own. A card is a shop window: it belongs on
 * pages carrying a dozen of them, where a dozen iframes would be a dozen
 * players' worth of script for a video nobody has asked for yet, and it would
 * send someone watching a battle away from everything the battle is about.
 * The thumbnail is an image until the click, and the click goes where the video
 * can be watched properly.
 */
export function TankVideoCard({
  group,
  region,
}: {
  group: TankVideoGroup;
  /** For the links to the tanks a video covers, on the community index. */
  region: Region;
}) {
  const player = useTankVideoPlayer();
  // Which row is lit follows the playhead, not the last click: the player
  // publishes it, since only something mounted beside it can watch its clock.
  const isCurrent = player?.current?.videoId === group.videoId;
  const playingId = isCurrent ? (player?.activeId ?? null) : null;

  const publishedCount = group.battles.filter((b) => !b.pending).length;

  // Where a battle is watched when this card has no player above it: the Videos
  // tab of the tank it was played in, opened on that battle. Queued rows lead
  // there too: the row is only on screen for the person who submitted it, and
  // watching it is how they check the second they picked.
  function watchHref(battle: TankVideoCardData): string | null {
    if (battle.tankSlug) {
      return `${tankDetailTabHref(
        ROUTES.TANK(region, battle.tankSlug),
        TankDetailTab.Videos,
      )}?${BATTLE_PARAM}=${battle.id}`;
    }
    // A tactic has no vehicle, so it belongs to the ground it was fought on.
    if (battle.mapSlug) {
      return `${ROUTES.MAP(region, battle.mapSlug)}?${BATTLE_PARAM}=${battle.id}`;
    }
    return null;
  }

  function play(battle: TankVideoCardData) {
    player?.play(battle);
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-fd-card",
        isCurrent ? "border-brand" : "border-fd-border",
      )}
    >
      <div className="relative aspect-video w-full bg-black">
        <Thumbnail
          title={group.title}
          onPlay={player ? () => play(group.battles[0]) : undefined}
          href={watchHref(group.battles[0])}
        >
          <Image
            src={youtubeThumbnailUrl(group.videoId)}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
            <PlayIcon
              weight="fill"
              className="size-12 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
            />
          </span>
          {/* What the video is worth to someone scanning the tab: how many
                battles of this tank are in it. Published ones only: a row still
                in review is a receipt for its submitter, not something the
                video offers yet. */}
          <span className="absolute right-2 bottom-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-xs text-white">
            {publishedCount} {publishedCount > 1 ? "battles" : "battle"}
          </span>
        </Thumbnail>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <span className="line-clamp-2 font-medium text-fd-foreground">
          {group.title}
        </span>
        {/* Only on the community index: a tank's own page knows which tank it
            is, and repeating it on every card would be noise. Links rather
            than text, since this is the way back to where the battle belongs. */}
        {(group.tanks.length > 0 || group.clans.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
            {group.tanks.map((tank, i) => (
              <span key={tank.slug} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-fd-border">·</span>}
                <Link
                  href={ROUTES.TANK(region, tank.slug)}
                  className="font-medium text-brand hover:underline"
                >
                  {tank.name}
                </Link>
              </span>
            ))}
            {/* The clans that played it, where a random battle names vehicles.
                Both can appear on one card: a VOD can hold a stronghold evening
                and the random games either side of it. */}
            {group.clans.map((clan, i) => (
              <span key={clan.tag} className="flex items-center gap-1.5">
                {(i > 0 || group.tanks.length > 0) && (
                  <span className="text-fd-border">·</span>
                )}
                <Link
                  href={ROUTES.CLAN(region, clan.tag)}
                  className="flex items-center gap-1.5 font-medium hover:underline"
                >
                  {clan.emblem && (
                    <Image
                      src={clan.emblem}
                      alt=""
                      width={16}
                      height={16}
                      className="size-4 shrink-0 rounded"
                    />
                  )}
                  <ClanTag tag={clan.tag} color={clan.color} />
                </Link>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-fd-muted-foreground">
          {/* The channel first: a suggestion exists because someone made the
              video, and the tab is meant to be worth being listed in. */}
          <span className="font-medium">{group.channelName}</span>
          {group.publishedAt && (
            <>
              <span className="text-fd-border">·</span>
              {/* When it went up, not when it was suggested here: a tactic from
                  last season is a tactic from last season whatever day someone
                  got round to linking it. */}
              <PublishedDate date={group.publishedAt} />
            </>
          )}
          {group.gameVersion && (
            <>
              <span className="text-fd-border">·</span>
              <span>{group.gameVersion}</span>
            </>
          )}
          <span className="text-fd-border">·</span>
          <a
            href={youtubeWatchUrl(group.videoId, 0)}
            target="_blank"
            // Outbound: `nofollow` so a suggested link cannot be used to pass
            // authority, `noopener`/`noreferrer` so the opened tab gets neither
            // a handle on ours nor where it came from.
            rel="nofollow noopener noreferrer"
            className="hover:text-fd-foreground hover:underline"
          >
            Watch on YouTube
          </a>
        </div>

        <ul className="mt-auto flex flex-col pt-1">
          {group.battles.map((battle) => (
            <li key={battle.id}>
              <BattleRow
                battle={battle}
                // Named per row only when the card holds several: with one
                // tank the header already says it.
                showTank={group.tanks.length > 1}
                active={battle.id === playingId}
                onPlay={player ? () => play(battle) : undefined}
                href={watchHref(battle)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
