import type { Region } from "@unicum.gg/wargaming";
import { LiveBadge } from "@/components/live-badge";
import {
  SupporterBadge,
  SupporterBadgeState,
} from "@/components/entity/badges/supporter-badge";
import { VerifiedBadge } from "@/components/entity/badges/verified-badge";
import { StreamerBadge } from "@/components/entity/badges/streamer-badge";
import { OnslaughtBadge } from "@/components/entity/badges/onslaught-badge";
import { TournamentBadge } from "@/components/entity/badges/tournament-badge";
import {
  BadgeCluster,
  type ClusterBadge,
} from "@/components/entity/badges/badge-cluster";
import {
  Crest,
  CrestKind,
  crestTincture,
} from "@/components/entity/badges/crest";
import type { PlayerIdentity } from "@/components/entity/player-identity";
import ROUTES from "@/constants/routes";

/**
 * Build a player's crests in the order the fold reads them, best first.
 *
 * Shared by the inline cluster below and by the profile header, which draws its
 * own row at a larger size and with the owner-only supporter states the inline
 * one never sees. They agreed by coincidence before, and duly drifted: the
 * header was still listing four badges when a fifth had been added elsewhere,
 * so a crest earned on the leaderboards was missing from the player's own page.
 * One builder means a badge is added in one place.
 *
 * ORDER IS PRIORITY, because past three the tail folds into a "+N". So it runs
 * from what a player earned to what a player merely has: the two competitive
 * crests first (they are the rarest thing here, a few thousand accounts in two
 * million), then the supporter crest, which is the visible half of an active
 * subscription and should not be the first thing folded away, then the Twitch
 * link, then verification, which is last precisely because it costs nothing but
 * signing in and is therefore the least it can say about anyone.
 */
export function buildPlayerBadges({
  region,
  nickname,
  isVerified,
  supporterState,
  twitchLogin,
  tournamentWins,
  tournamentFeaturedWins,
  tournamentBestTitle,
  onslaughtBestTier,
  onslaughtBestRank,
  onslaughtSeasons,
  size,
}: {
  region: Region;
  nickname: string;
  isVerified: boolean;
  /** Null when there is no supporter crest to draw at all. */
  supporterState: SupporterBadgeState | null;
  twitchLogin: string | null;
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  onslaughtBestTier: string | null;
  onslaughtBestRank: number | null;
  onslaughtSeasons: number;
  size?: number;
}): ClusterBadge[] {
  const badges: ClusterBadge[] = [];

  if (onslaughtBestTier === "legend" || onslaughtBestTier === "champion") {
    const onslaughtKind =
      onslaughtBestTier === "legend"
        ? CrestKind.OnslaughtLegend
        : CrestKind.OnslaughtChampion;
    badges.push({
      key: "onslaught",
      href: ROUTES.PLAYER_ONSLAUGHT(region, nickname),
      label: `Onslaught ${onslaughtBestTier === "legend" ? "Legend" : "Champion"}`,
      // The bare crest for the fold's tooltip, picking the same tincture the
      // badge itself would. Kept beside it so the two cannot drift.
      crest: <Crest kind={onslaughtKind} />,
      tint: crestTincture(onslaughtKind),
      node: (
        <OnslaughtBadge
          region={region}
          nickname={nickname}
          tier={onslaughtBestTier}
          bestRank={onslaughtBestRank}
          seasons={onslaughtSeasons}
          size={size}
        />
      ),
    });
  }

  if (tournamentWins > 0) {
    const tournamentKind =
      tournamentFeaturedWins > 0
        ? CrestKind.TournamentFeatured
        : CrestKind.Tournament;
    badges.push({
      key: "tournament",
      href: ROUTES.PLAYER_TOURNAMENTS(region, nickname),
      label:
        tournamentWins === 1
          ? "1 tournament win"
          : `${tournamentWins} tournament wins`,
      crest: <Crest kind={tournamentKind} />,
      tint: crestTincture(tournamentKind),
      node: (
        <TournamentBadge
          region={region}
          nickname={nickname}
          wins={tournamentWins}
          featuredWins={tournamentFeaturedWins}
          bestTitle={tournamentBestTitle}
          size={size}
        />
      ),
    });
  }

  if (supporterState) {
    const supporterMuted = supporterState !== SupporterBadgeState.Active;
    badges.push({
      key: "supporter",
      // Every folded badge keeps the destination its crest had, or the fold
      // would be a way of losing links rather than of saving room.
      href: ROUTES.SUPPORT,
      label: "Supporter",
      crest: <Crest kind={CrestKind.Supporter} muted={supporterMuted} />,
      tint: crestTincture(CrestKind.Supporter, supporterMuted),
      node: <SupporterBadge state={supporterState} size={size} />,
    });
  }

  if (twitchLogin) {
    badges.push({
      key: "streamer",
      href: `https://www.twitch.tv/${twitchLogin}`,
      label: `Watch ${twitchLogin} on Twitch`,
      crest: <Crest kind={CrestKind.Streamer} />,
      tint: crestTincture(CrestKind.Streamer),
      node: <StreamerBadge login={twitchLogin} size={size} />,
    });
  }

  if (isVerified) {
    badges.push({
      key: "verified",
      label: "Verified account",
      crest: <Crest kind={CrestKind.Verified} />,
      tint: crestTincture(CrestKind.Verified),
      node: <VerifiedBadge size={size} />,
    });
  }

  return badges;
}

/**
 * The crest cluster shown after a nickname, capped so the name stays readable.
 *
 * Rendered by `PlayerName` rather than by its callers. It used to be a slot
 * each table filled in itself, and the slot was duly forgotten: the clan
 * members table passed no tournament fields, so a winner wore the crest on the
 * home leaderboard and nothing in their own clan's list, and the tank page's
 * top players got no crests at all. Reading them off one identity object is
 * what makes the format the same everywhere by construction.
 *
 * The live pill sits outside the cluster and outside the count, because it is
 * not a badge but a state: it is not earned, it is not kept, and it resolves
 * itself from the shared streamers stream while the player is actually on air.
 * Folding it into a "+N" would hide the one mark that is only true right now.
 */
export function PlayerBadges({
  region,
  player,
}: {
  region: Region;
  player: PlayerIdentity;
}) {
  const badges = buildPlayerBadges({
    region,
    nickname: player.nickname,
    isVerified: Boolean(player.isVerified),
    supporterState: player.isSupporter ? SupporterBadgeState.Active : null,
    twitchLogin: player.twitchLogin ?? null,
    tournamentWins: player.tournamentWins ?? 0,
    tournamentFeaturedWins: player.tournamentFeaturedWins ?? 0,
    tournamentBestTitle: player.tournamentBestTitle ?? null,
    onslaughtBestTier: player.onslaughtBestTier ?? null,
    onslaughtBestRank: player.onslaughtBestRank ?? null,
    onslaughtSeasons: player.onslaughtSeasons ?? 0,
  });

  return (
    <>
      <BadgeCluster badges={badges} />
      {player.accountId != null && (
        <LiveBadge region={region} accountId={player.accountId} />
      )}
    </>
  );
}
