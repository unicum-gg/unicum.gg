/** A break in the numbering, where the pages between two entries are not drawn. */
export const PAGE_GAP = "gap" as const;

export type PageWindowEntry = number | typeof PAGE_GAP;

/** How many numbers are drawn before the window starts leaving any out. */
const FULL_WIDTH = 7;

/**
 * The page numbers a pager draws: the first, the last, the current one and its
 * neighbours, with the runs in between collapsed.
 *
 * Its own module because it is arithmetic with edges (a table of one page, a
 * current page against either end, a gap hiding a single number) and the pager
 * around it is markup.
 */
export function pageWindow(current: number, totalPages: number): PageWindowEntry[] {
  if (totalPages <= FULL_WIDTH) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const wanted = new Set<number>([1, totalPages]);
  // One neighbour each side, plus whatever the opposite end is not asking for:
  // the first page draws 1 2 3 rather than 1 2, and the width stays put as the
  // current page walks across.
  const reach = 1;
  const lowRoom = Math.max(0, reach - (current - 1));
  const highRoom = Math.max(0, reach - (totalPages - current));
  for (let n = current - reach - highRoom; n <= current + reach + lowRoom; n++) {
    if (n >= 1 && n <= totalPages) wanted.add(n);
  }

  const pages = [...wanted].sort((a, b) => a - b);
  const entries: PageWindowEntry[] = [];
  for (const [i, page] of pages.entries()) {
    const previous = pages[i - 1];
    if (previous !== undefined && page - previous > 1) {
      // A gap hiding one page is wider than the page it hides.
      if (page - previous === 2) entries.push(page - 1);
      else entries.push(PAGE_GAP);
    }
    entries.push(page);
  }
  return entries;
}
