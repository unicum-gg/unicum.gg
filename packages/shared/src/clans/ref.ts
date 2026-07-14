/** Minimal clan reference used across player/clan views (client-safe shape).
 * The lookups + emblem picking live in core (`wargaming/wot/clans/info`). */
export type ClanRef = {
  id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  // Empty `[]` from the public API (no languages there); enriched by callers.
  languages: string[];
};
