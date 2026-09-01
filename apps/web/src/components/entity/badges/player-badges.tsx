import type { Region } from "@unicum.gg/wargaming";
import { LiveBadge } from "@/components/live-badge";
import {
  SupporterBadge,
  SupporterBadgeState,
} from "@/components/entity/badges/supporter-badge";
import { VerifiedBadge } from "@/components/entity/badges/verified-badge";
import { StreamerBadge } from "@/components/entity/badges/streamer-badge";
import { TournamentBadge } from "@/components/entity/badges/tournament-badge";

/**
 * The public badge cluster shown after a nickname wherever a player appears
 * (leaderboards, clan members, search, tank top players). Drop into
 * `PlayerName`'s `badges` slot. The three crests (verified, supporter, streamer)
 * come from the row payload, resolved server-side, in a fixed order, and the
 * tournament crest rides with them. The live
 * pill is separate: it self-resolves from the shared streamers stream and only
 * shows while the player is actually streaming. Each renders nothing when it
 * doesn't apply, so this is always safe to mount.
 */
export function PlayerBadges({
  region,
  accountId,
  nickname = null,
  verified = false,
  supporter = false,
  twitchLogin = null,
  tournamentWins = 0,
  tournamentFeaturedWins = 0,
  tournamentBestTitle = null,
}: {
  region: Region;
  accountId: number;
  /** Needed only by the tournament crest, which links to this player's own
   * Tournaments tab. Without it the crest still renders, just not as a link. */
  nickname?: string | null;
  verified?: boolean;
  supporter?: boolean;
  /** Twitch login when the account is a streamer; the crest links to it. */
  twitchLogin?: string | null;
  /** Tournaments this account was on the winning roster of. */
  tournamentWins?: number;
  tournamentFeaturedWins?: number;
  tournamentBestTitle?: string | null;
}) {
  return (
    <>
      {verified && <VerifiedBadge />}
      {supporter && <SupporterBadge state={SupporterBadgeState.Active} />}
      {twitchLogin && <StreamerBadge login={twitchLogin} />}
      <TournamentBadge
        region={region}
        nickname={nickname}
        wins={tournamentWins}
        featuredWins={tournamentFeaturedWins}
        bestTitle={tournamentBestTitle}
      />
      <LiveBadge region={region} accountId={accountId} />
    </>
  );
}
