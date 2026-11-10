/**
 * Rows asked for per board. The whole board ships in the HTML and paginates
 * client-side, like the other leaderboards; the source caps a board at a
 * thousand rows and the API clamps to it, so this asks for the ceiling.
 *
 * Its own module rather than beside the edition context: that file is
 * `"use client"`, and a server component importing a plain value from one is
 * handed a client reference instead of the number.
 */
export const MANEUVERS_LIMIT = 1000;
