/**
 * How a page of a list is named, in the URL and in the route tree, and how many
 * rows one holds.
 *
 * Its own module because the places that need it cannot import each other: the
 * pagers are client components, the metadata builder and the range guard are
 * server-only, and the proxy runs before either. The whole SEO pattern rests on
 * those agreeing, since `?page=` is rewritten onto `/page/<n>`, the canonical
 * declares the query form again, and the route decides whether page N exists by
 * dividing the list by the size the board will draw it at.
 *
 * The sizes live HERE rather than beside each board for a reason worth keeping:
 * a `"use client"` module exports client REFERENCES, so a server component that
 * imports a plain const from one is handed a function rather than the number.
 * Nothing breaks loudly. `Math.ceil(total / size)` is quietly NaN, every
 * comparison against it is false, and a route that should have 404ed an
 * out-of-range page answers 200 with the last page's rows under the wrong
 * number, which is exactly the unbounded crawl space the guard exists to close.
 */
const PAGINATION = {
  /** The query param a reader, a crawler and a shared link all see. */
  PARAM: "page",
  /** The route segment it is rewritten onto (`/eu/players/page/2`). */
  SEGMENT: "page",
  /** Rows per page, by the kind of table rather than by the section: the three
   * shapes on the site each read at their own density. */
  SIZE: {
    /** A ranking, one row per player. */
    LEADERBOARD: 100,
    /** A catalogue, one row per vehicle, with far more columns to a row. */
    CATALOGUE: 50,
    /** A feed, where one entry is a block rather than a line. */
    FEED: 25,
  },
};

export default PAGINATION;
