import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The player leaderboards, as the mode tabs name them.
 *
 * An enum rather than the string union this used to be, because three separate
 * components now read it: the tab bar highlights the current one, and the
 * language picker and the strict toggle have to know which section's addresses
 * to navigate to. A union spelled out at each of those is three places for a
 * fourth board to be forgotten.
 */
export enum PlayerBoard {
  Overall = "overall",
  SteelHunter = "steel-hunter",
  Onslaught = "onslaught",
  Marks = "marks",
}

/**
 * Where a board's own language views live.
 *
 * The picker and the toggle are shared between the boards that HAVE language
 * views, so they take the board and look its addresses up here rather than
 * reaching for `ROUTES.PLAYERS_*` directly. Passing route builders as props is
 * not an option: the picker is a client component and a server component
 * cannot hand it a function.
 *
 * Steel Hunter and Onslaught are absent because neither has a language view:
 * one ranks the game's own standings and the other a mode's rating, and nothing
 * on either page offers the filter. Asking for their addresses is a mistake
 * worth a compile error rather than a URL that 404s.
 */
const LANGUAGE_ROUTES = {
  [PlayerBoard.Overall]: {
    all: ROUTES.PLAYERS,
    byLanguage: ROUTES.PLAYERS_BY_LANGUAGE,
  },
  [PlayerBoard.Marks]: {
    all: ROUTES.PLAYERS_MARKS,
    byLanguage: ROUTES.PLAYERS_MARKS_BY_LANGUAGE,
  },
} as const;

/** A board that offers the language filter. */
export type FilterableBoard = keyof typeof LANGUAGE_ROUTES;

export function boardHref(board: FilterableBoard, region: Region): string {
  return LANGUAGE_ROUTES[board].all(region);
}

export function boardLanguageHref(
  board: FilterableBoard,
  region: Region,
  language: string,
  strict: boolean = false,
): string {
  return LANGUAGE_ROUTES[board].byLanguage(region, language, strict);
}
