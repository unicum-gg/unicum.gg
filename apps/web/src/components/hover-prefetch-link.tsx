import Link from "next/link";
import type { ComponentPropsWithRef } from "react";

/**
 * `next/link` with Next's default prefetching, re-exported under the name the
 * codebase already imports everywhere.
 *
 * WHY IT IS A PLAIN LINK NOW
 * Navigation cost is binary: a prefetched route commits in ~40-70ms with no
 * request at all, an unprefetched one costs 500-1300ms (the RSC payload
 * round-trip). That holds for every App Router site, nextjs.org included, which
 * eagerly prefetches ~29 routes on load. So prefetching is the whole game.
 *
 * This used to start at `prefetch={false}` and swap to `prefetch={null}` on
 * hover/focus, to spare the origin. It did not work: Next's internal
 * IntersectionObserver has already handled the link by then, and flipping the
 * prop afterwards does not re-arm it, so the prefetch never fired (measured:
 * zero prefetch requests on the tank index). On touch devices there is no hover
 * at all, so it could not have worked there either.
 *
 * The cost it was guarding against is now absorbed by the CDN, since the RSC
 * payloads are cached at the edge (~20ms on a hit). One screen of the tank index
 * prefetches 8 links for ~127kB total, which is the weight of a single image.
 *
 * Kept as a named component rather than deleted so the ~30 call sites keep
 * working, and so there is one place to reintroduce throttling if the origin
 * ever needs it again.
 */
export function HoverPrefetchLink(props: ComponentPropsWithRef<typeof Link>) {
  return <Link {...props} />;
}
