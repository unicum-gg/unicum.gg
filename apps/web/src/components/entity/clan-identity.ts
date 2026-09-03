import type { ClanRankBadge } from "@unicum.gg/shared";

/**
 * Everything the site shows about a clan inline: the coloured tag, the full
 * name when the layout has room, its emblem, and the crests it has earned.
 *
 * The mirror of `PlayerIdentity`, and for the same reason: a caller passes what
 * it has, the rendering decides what to show, and nothing can be forgotten on
 * the way. Every field but the tag is optional, so a row that knows only a tag
 * renders one instead of failing to compile.
 */
export type ClanIdentity = {
  tag: string;
  color?: string | null;
  /** The full clan name, shown after the tag where the layout allows. */
  name?: string | null;
  emblem?: string | null;
  /** Board placings, already ordered best-first by the resolver. */
  badges?: ClanRankBadge[] | null;
  tournamentWins?: number;
  tournamentFeaturedWins?: number;
  tournamentBestTitle?: string | null;
};

/**
 * Read a clan identity off an API row.
 *
 * Snake_case on purpose, like `identityFromRow`: a camelCase row satisfies this
 * shape through the optional fields alone, so it would type check and silently
 * drop every crest. Callers whose source is camelCase build the identity
 * literally instead.
 */
export function clanIdentityFromRow(row: {
  tag: string;
  color?: string | null;
  name?: string | null;
  emblem?: string | null;
  badges?: ClanRankBadge[] | null;
  tournament_wins?: number;
  tournament_featured_wins?: number;
  tournament_best_title?: string | null;
}): ClanIdentity {
  return {
    tag: row.tag,
    color: row.color,
    name: row.name,
    emblem: row.emblem,
    badges: row.badges,
    tournamentWins: row.tournament_wins,
    tournamentFeaturedWins: row.tournament_featured_wins,
    tournamentBestTitle: row.tournament_best_title,
  };
}
