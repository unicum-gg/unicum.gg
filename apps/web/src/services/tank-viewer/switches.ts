// The switches a change to the picture is judged with.
//
// Three of them, all comparisons against the game rather than anything a reader
// would want: whether the wheels turn, whether the detail relief is softened,
// and which way a track link faces. They live in the query string because that
// is what survives a reload and can be pasted next to a screenshot.

/**
 * One switch, read when it is asked for.
 *
 * **Not at import.** These were read into module constants, which works only
 * because the whole viewer is reached through a dynamic import inside an
 * effect: the moment any of these modules gains a static importer from a
 * component Next renders on the server, `location` is not defined and the
 * render throws. Read here, on a server there is simply no switch.
 */
export function switched(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}
