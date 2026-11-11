/**
 * Rows per page on a Maneuvers board, and the counts a reader can pick. The
 * board is paged by the endpoint rather than shipped whole: EU's autumn 2026
 * edition ranked 15,000 players, which is over twenty megabytes of HTML.
 *
 * Its own module rather than beside the edition context: that file is
 * `"use client"`, and a server component importing a plain value from one is
 * handed a client reference instead of the number.
 */
export const MANEUVERS_PAGE_SIZE = 100;
export const MANEUVERS_PAGE_SIZES = [25, 50, 100, 200] as const;
