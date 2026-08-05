"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";

/**
 * Client-side navbar logo. The previous server-rendered `nav.url` was
 * frozen at the initial SSR (root layout doesn't re-execute on soft-nav),
 * so navigating from /asia/... to /eu/... left the logo pointing at /asia
 * and a click on it bounced the user back to the old region. Computing
 * the region client-side keeps it always aligned with the URL and cookie.
 *
 * Passed to fumadocs as `nav.title` (which accepts an FC of anchor
 * props), so fumadocs gives us its outer anchor props that we forward to
 * Next's Link. We override `href` with our region-aware value.
 */
export function NavLogo(props: ComponentProps<"a">) {
  const { region } = useRegion();
  return (
    <Link {...props} href={ROUTES.HOME(region)}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 1104.586 1511.305"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`${APP.NAME} Logo`}
      >
        <path
          d="M316.11 55.984L56.036 315.941V946.07l496.271 487.021 496.251-487.021V315.96L788.496 55.984H316.11zM8.304 284.584L284.914 8.24 293.096 0h518.379l8.18 8.24 276.629 276.344 8.303 8.316v676.439l-8.406 8.229-524.299 514.538-19.574 19.197-19.6-19.197L8.429 977.571 0 969.341V292.905l8.304-8.321z"
          fill="var(--brand)"
        />
        <path
          d="M316 56 L788 56 L1048 316 L1048 946 L552 1433 L56 946 L56 316 Z"
          fill="#F5F5F5"
        />
        <g fill="var(--brand)">
          <path d="M 380 56 L 724 56 L 552 540 Z" />
          <path d="M 200 280 L 320 56 L 280 360 Z" />
          <path d="M 904 280 L 784 56 L 824 360 Z" />
          <path d="M 250 660 L 420 700 L 400 750 L 250 710 Z" />
          <path d="M 854 660 L 684 700 L 704 750 L 854 710 Z" />
          <path d="M 545 950 L 559 950 L 552 1300 Z" />
          <path d="M 470 1140 L 500 1185 L 470 1230 L 440 1185 Z" />
          <path d="M 634 1140 L 604 1185 L 634 1230 L 664 1185 Z" />
        </g>
      </svg>
      {APP.NAME}
    </Link>
  );
}
