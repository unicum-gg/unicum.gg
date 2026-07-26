import type { Region } from "@unicum.gg/wargaming";
import { LiveBadge } from "@/components/live-badge";
import {
  SupporterBadge,
  SupporterBadgeState,
} from "@/components/entity/badges/supporter-badge";
import { VerifiedBadge } from "@/components/entity/badges/verified-badge";
import { StreamerBadge } from "@/components/entity/badges/streamer-badge";

/**
 * The public badge cluster shown after a nickname wherever a player appears
 * (leaderboards, clan members, search, tank top players). Drop into
 * `PlayerName`'s `badges` slot. The three crests (verified, supporter, streamer)
 * come from the row payload, resolved server-side, in a fixed order. The live
 * pill is separate: it self-resolves from the shared streamers stream and only
 * shows while the player is actually streaming. Each renders nothing when it
 * doesn't apply, so this is always safe to mount.
 */
export function PlayerBadges({
  region,
  accountId,
  verified = false,
  supporter = false,
  twitchLogin = null,
}: {
  region: Region;
  accountId: number;
  verified?: boolean;
  supporter?: boolean;
  /** Twitch login when the account is a streamer; the crest links to it. */
  twitchLogin?: string | null;
}) {
  return (
    <>
      {verified && <VerifiedBadge />}
      {supporter && <SupporterBadge state={SupporterBadgeState.Active} />}
      {twitchLogin && <StreamerBadge login={twitchLogin} />}
      <LiveBadge region={region} accountId={accountId} />
    </>
  );
}
