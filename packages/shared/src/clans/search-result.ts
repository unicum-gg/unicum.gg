/** A clan search hit (client-safe shape). The lookups live in core
 * (`wargaming/wot/clans/search`). */
export type ClanSearchResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  members_count: number;
  emblem: string | null;
};
