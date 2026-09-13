import "server-only";
import { notFound } from "next/navigation";

/** How many pages a list of `total` rows holds, drawn `size` to a page. */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * 404 a `/page/[n]` that names a page the list does not hold.
 *
 * The alternative is rendering an empty board, which makes every number a
 * crawler cares to try a live URL: a leaderboard would have no last page, and
 * each one of them would be held in the ISR cache for as long as it was asked
 * for. `page` is undefined on the routes that serve only the first page (the
 * per-language landings share their view with the paginated ones), and there is
 * nothing to bound there.
 */
export function assertPageInRange(
  page: number | undefined,
  total: number,
  size: number,
): void {
  if (page === undefined || page <= 1) return;
  if (page > pageCount(total, size)) notFound();
}
