import type { Region } from "@unicum.gg/wargaming";
import { LiveBadge } from "@/components/live-badge";
import {
  SupporterBadge,
  SupporterBadgeState,
} from "@/components/entity/badges/supporter-badge";
import { VerifiedBadge } from "@/components/entity/badges/verified-badge";
import { StreamerBadge } from "@/components/entity/badges/streamer-badge";
import { TournamentBadge } from "@/components/entity/badges/tournament-badge";
import type { PlayerIdentity } from "@/components/entity/player-identity";

/**
 * The crest cluster shown after a nickname, in a fixed order.
 *
 * Rendered by `PlayerName` rather than by its callers. It used to be a slot
 * each table filled in itself, and the slot was duly forgotten: the clan
 * members table passed no tournament fields, so a winner wore the crest on the
 * home leaderboard and nothing in their own clan's list, and the tank page's
 * top players got no crests at all. Reading them off one identity object is
 * what makes the format the same everywhere by construction.
 *
 * Each badge renders nothing when it does not apply, so this is always safe to
 * mount. The live pill is the odd one out: it resolves itself from the shared
 * streamers stream and only shows while the player is actually on air, which is
 * why it needs the account id and is skipped without one.
 */
export function PlayerBadges({
  region,
  player,
}: {
  region: Region;
  player: PlayerIdentity;
}) {
  return (
    <>
      {player.isVerified && <VerifiedBadge />}
      {player.isSupporter && <SupporterBadge state={SupporterBadgeState.Active} />}
      {player.twitchLogin && <StreamerBadge login={player.twitchLogin} />}
      <TournamentBadge
        region={region}
        nickname={player.nickname}
        wins={player.tournamentWins ?? 0}
        featuredWins={player.tournamentFeaturedWins ?? 0}
        bestTitle={player.tournamentBestTitle ?? null}
      />
      {player.accountId != null && (
        <LiveBadge region={region} accountId={player.accountId} />
      )}
    </>
  );
}
