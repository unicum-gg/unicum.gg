import { pageUrl } from "@/lib/metadata";
import { pageCount } from "@/lib/pagination";

/**
 * The `rel="prev"` and `rel="next"` of a paginated section.
 *
 * **Google has not read these since 2019** and says so plainly, so nothing here
 * is load-bearing for the ranking: the crawlable links in the pager are what
 * carries the chain. Bing still takes them as a hint about how a set of pages
 * fits together, a browser may prefetch on them, and a screen reader can offer
 * them as document relationships, which is three reasons to spend the two lines
 * and none to leave them out.
 *
 * They are `<link>` elements rendered in the page body rather than a Metadata
 * field, because Next's Metadata API models `canonical`, `languages`, `media`
 * and `types` and nothing else under `alternates`. React hoists a `<link>` into
 * the document head wherever it is rendered, so this lands in the same place a
 * metadata entry would have.
 *
 * The addresses come from the same builder the canonical does, since a `next`
 * pointing at a URL that differs from that page's own canonical by so much as a
 * slash describes a page that does not exist.
 */
export function PaginationRelLinks({
  path,
  page,
  total,
  size,
  locale,
}: {
  /** The section's own bare path, the one its canonical is built from. */
  path: string;
  /**
   * The page being rendered, or undefined where no route serves a second one.
   * Same switch as the pager's `crawlable`: a section whose pages have no
   * address must not advertise them.
   */
  page: number | undefined;
  total: number;
  size: number;
  locale: string;
}) {
  if (page === undefined) return null;
  const pages = pageCount(total, size);
  return (
    <>
      {page > 1 && <link rel="prev" href={pageUrl(path, page - 1, locale)} />}
      {page < pages && <link rel="next" href={pageUrl(path, page + 1, locale)} />}
    </>
  );
}
