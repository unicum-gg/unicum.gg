import Link from "next/link";
import { Crest } from "@/components/entity/badges/crest";
import {
  CLAN_BOARD_DESCRIPTION,
  CLAN_BOARD_LABEL,
  CLAN_BOARD_TINCTURE,
  CLAN_BOARD_BY_STRONGHOLD_TIER,
  ClanBoard,
  StrongholdTier,
  type ClanRankBadge as ClanRankBadgeData,
} from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { TournamentBadge } from "@/components/entity/badges/tournament-badge";
import {
  BadgeCluster,
  type ClusterBadge,
} from "@/components/entity/badges/badge-cluster";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Reversed from the single tier-to-board table in shared, so the link target
 * cannot drift from what the tier pages themselves consider their own board.
 * The rating boards are absent, which is what marks them as non-stronghold.
 */
const STRONGHOLD_TIER = Object.fromEntries(
  Object.entries(CLAN_BOARD_BY_STRONGHOLD_TIER).map(([tier, board]) => [
    board,
    tier as StrongholdTier,
  ]),
) as Partial<Record<ClanBoard, StrongholdTier>>;

/**
 * Where clicking a crest goes: every board is a stronghold tier and every tier
 * has its own page. The `/clans` fallback is kept for a board added to the enum
 * before its page exists, which is what the reverse table's `Partial` allows
 * for; it is unreachable today.
 */
function boardHref(region: Region, board: ClanBoard): string {
  const tier = STRONGHOLD_TIER[board];
  return tier ? ROUTES.STRONGHOLD(region, tier) : ROUTES.CLANS(region);
}

/**
 * The crest's charge, typeset and centred on the hexagon (50, 43.3) like the
 * identity devices.
 *
 * `<text>` rather than the vector paths the other crests use: the label runs up
 * to "10" (and "+N" for the overflow), and hand-drawing those glyphs would be
 * both unmaintainable and worse-looking than a real typeface. The usual
 * objection to `<text>` in an icon is that it inherits whatever font the page
 * has, so the stack is pinned here, and `textLength` locks the advance width so
 * a two-character label cannot spill past the hexagon's flat edges whatever the
 * fallback font turns out to be.
 */
function TextCharge({ label }: { label: string }) {
  const twoChar = label.length >= 2;
  return (
    <text
      x="50"
      y="43.3"
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      fontSize={twoChar ? 42 : 54}
      fontWeight="700"
      textLength={twoChar ? 46 : undefined}
      lengthAdjust="spacingAndGlyphs"
    >
      {label}
    </text>
  );
}

/**
 * One leaderboard placing, shown after a clan tag wherever the clan appears.
 *
 * Built on the same hexagon crest as the player identity badges rather than as
 * a pill of its own: these sit side by side with them (a clan tag on a player
 * row, a member list) and a different shape would read as a different system.
 *
 * The two signals are split across the two things a crest has: the tincture is
 * the board and the charge is the rank. Podium metals would have said the rank
 * twice and the board not at all, leaving a clan's cluster as a row of
 * indistinguishable medals, and there are only three metals where the badge
 * now runs to ten.
 */
export function ClanRankBadge({
  badge,
  region,
  size = 16,
}: {
  badge: ClanRankBadgeData;
  region: Region;
  /** Height in px, matching the player crests' `size`. */
  size?: number;
}) {
  const tincture = CLAN_BOARD_TINCTURE[badge.board];
  if (!tincture) return null;

  const label = `Rank ${badge.rank} on the ${CLAN_BOARD_DESCRIPTION[badge.board]}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={boardHref(region, badge.board)}
            className="inline-flex shrink-0"
            aria-label={label}
          >
            <Crest
              tincture={tincture}
              size={size}
              charge={<TextCharge label={String(badge.rank)} />}
            />
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-semibold">
            #{badge.rank} {CLAN_BOARD_LABEL[badge.board]}
          </span>{" "}
          · {CLAN_BOARD_DESCRIPTION[badge.board]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The whole cluster, already ordered by the resolver (best placing first).
 * Renders nothing when the clan holds no placing, so it is always safe to mount.
 *
 * A clan can hold up to four placings, one per stronghold board, so past `max`
 * the rest fold into a single "+N" crest whose tooltip still lists them. The
 * fold was sized when there were seven, the three rating boards included; it
 * fires rarely now and is kept because nothing stops a fifth board being added. Because the list is pre-sorted, the ones
 * that stay visible are always the clan's best.
 *
 * Every crest is a link to its board, so this must not be mounted inside another
 * anchor: callers that put it in a row link have to lift it out of the link
 * first (see the top-clans table).
 */
export function ClanBadges({
  badges,
  region,
  tag,
  tournamentWins = 0,
  tournamentFeaturedWins = 0,
  tournamentBestTitle = null,
  size = 16,
  max = 3,
}: {
  badges?: ClanRankBadgeData[] | null;
  region: Region;
  /** Needed only by the tournament crest, which links to this clan's own
   * Tournaments tab. Without it the crest still renders, just not as a link. */
  tag?: string | null;
  /** Tournaments a team attributed to this clan won. */
  tournamentWins?: number;
  tournamentFeaturedWins?: number;
  tournamentBestTitle?: string | null;
  size?: number;
  /** How many crests to show before folding the rest into "+N". */
  max?: number;
}) {
  // The tournament crest is not a placing, so it sits outside the fold: the
  // "+N" counts board ranks, which are a set that can grow to seven, while this
  // is one mark a clan either has or does not.
  const trophy = (
    <TournamentBadge
      wins={tournamentWins}
      featuredWins={tournamentFeaturedWins}
      bestTitle={tournamentBestTitle}
      href={tag ? ROUTES.CLAN_TOURNAMENTS(region, tag) : undefined}
      size={size}
    />
  );
  if (!badges?.length) return trophy;
  // Folded by the same component the player crests use, so a clan and a player
  // standing on the same row cannot cap their clusters differently.
  const cluster: ClusterBadge[] = badges.map((b) => ({
    key: `${b.board}-${b.rank}`,
    href: boardHref(region, b.board),
    label: (
      <>
        <span className="font-semibold">
          #{b.rank} {CLAN_BOARD_LABEL[b.board]}
        </span>{" "}
        · {CLAN_BOARD_DESCRIPTION[b.board]}
      </>
    ),
    // The bare crest for the fold's tooltip: same tincture and same rank
    // charge as the badge, without the tooltip a nested one could not host.
    crest: (
      <Crest
        tincture={CLAN_BOARD_TINCTURE[b.board]}
        charge={<TextCharge label={String(b.rank)} />}
      />
    ),
    tint: CLAN_BOARD_TINCTURE[b.board],
    node: <ClanRankBadge badge={b} region={region} size={size} />,
  }));
  return (
    <>
      <BadgeCluster badges={cluster} size={size} max={max} />
      {trophy}
    </>
  );
}
