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

// Slate crest for the "+N" overflow: it is a count, not a placing, so it must
// not borrow any board's colour.
const OVERFLOW_TINCTURE = { fill: "#8b8b8b", edge: "#5f5f5f" };

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
 * A slate "+N" crest standing in for the placings past the display cap, with a
 * tooltip that spells them out so nothing is hidden, only folded. Not a link:
 * it represents several boards at once, so there is no single place to send to.
 */
function OverflowBadge({
  hidden,
  region,
  size,
}: {
  hidden: ClanRankBadgeData[];
  region: Region;
  size: number;
}) {
  return (
    <TooltipProvider>
      {/* Kept open while the pointer is over the content so its rows can be
          clicked: the "+N" crest is not itself a link (it stands for several
          boards), so the folded placings are only reachable through here. */}
      <Tooltip disableHoverableContent={false}>
        <TooltipTrigger asChild>
          <span
            className="inline-flex shrink-0 cursor-default"
            aria-label={`${hidden.length} more placings`}
          >
            <Crest
              tincture={OVERFLOW_TINCTURE}
              size={size}
              charge={<TextCharge label={`+${hidden.length}`} />}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="flex flex-col gap-0.5">
            {hidden.map((b) => (
              <Link
                key={`${b.board}-${b.rank}`}
                href={boardHref(region, b.board)}
                className="hover:underline"
              >
                <span className="font-semibold">
                  #{b.rank} {CLAN_BOARD_LABEL[b.board]}
                </span>{" "}
                · {CLAN_BOARD_DESCRIPTION[b.board]}
              </Link>
            ))}
          </span>
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
  // `max` is the total number of crests shown, the "+N" included. So once we
  // overflow, the "+N" takes one of those slots and only `max - 1` real crests
  // remain (4 placings, max 3 -> 2 crests + "+2"). The cluster is never wider
  // than `max`.
  const fold = badges.length > max;
  const shown = fold ? badges.slice(0, max - 1) : badges;
  const hidden = fold ? badges.slice(max - 1) : [];
  return (
    <>
      {shown.map((b) => (
        <ClanRankBadge
          key={`${b.board}-${b.rank}`}
          badge={b}
          region={region}
          size={size}
        />
      ))}
      {hidden.length > 0 && (
        <OverflowBadge hidden={hidden} region={region} size={size} />
      )}
      {trophy}
    </>
  );
}
