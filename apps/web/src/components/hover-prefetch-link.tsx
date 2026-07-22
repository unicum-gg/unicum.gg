"use client";

import Link from "next/link";
import { type ComponentPropsWithRef, useState } from "react";

/**
 * A `next/link` that does not prefetch on viewport entry, only once the user
 * shows intent (hover or focus). Use it for links that shouldn't eagerly
 * prefetch but should still feel instant on click:
 *
 * - links rendered in more than one place at once (a nav item duplicated across
 *   the desktop bar and the hidden mobile menu), where viewport prefetch fires
 *   from every copy, and
 * - secondary affordances whose region-cookie re-render churns the router tree.
 *
 * Both are heavily amplified by the Next 16 prefetch regression
 * (vercel/next.js#85470), which re-fetches a single eager link many times.
 * Starting at `prefetch={false}` suppresses that; the first hover/focus swaps to
 * `prefetch={null}`, which restores Next's default static prefetch (see the
 * "Hover-triggered prefetch" recipe in the Next.js prefetching guide).
 *
 * Drop-in for `<Link>`: forwards every prop and composes any passed
 * `onMouseEnter`/`onFocus`.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  onFocus,
  ref,
  ...props
}: ComponentPropsWithRef<typeof Link>) {
  const [prefetch, setPrefetch] = useState<false | null>(false);
  return (
    <Link
      {...props}
      // Forwarded so the link works as a Radix `asChild` slot child (tooltip /
      // dropdown triggers), which clone the child and pass it a ref.
      ref={ref}
      prefetch={prefetch}
      onMouseEnter={(e) => {
        setPrefetch(null);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setPrefetch(null);
        onFocus?.(e);
      }}
    />
  );
}
