/**
 * The SWR key for the reader's own suggestions.
 *
 * Its own module for the same reason `battle-param` is one: the correction form
 * drops this key after a save, and importing it from the player would close a
 * cycle (player → edit dialog → edit fields → player). That cycle survives only
 * while the export happens to be a hoisted function declaration, which is not a
 * property any file should have to keep.
 */
export function ownVideosKey(region: string): string {
  return `videos:mine:${region}`;
}
