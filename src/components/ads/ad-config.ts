import type { CSSProperties } from "react";

// AdSense publisher id for unicum.gg. Same account already wired in
// `src/components/script/index.tsx` (adsbygoogle.js loader).
export const AD_CLIENT = "ca-pub-3691404603790195";

export enum AdFormat {
  Banner = "banner",
  Rectangle = "rectangle",
  Sidebar = "sidebar",
  Anchor = "anchor",
  InFeed = "in-feed",
}

export type AdFormatConfig = {
  // Tailwind classes that reserve explicit space BEFORE the ad loads, per
  // breakpoint, so granting consent or filling the slot causes zero layout
  // shift. The container also clips overflow as a CLS safety net.
  containerClassName: string;
  insStyle: CSSProperties;
  // data-ad-format on the <ins> (e.g. "auto", "fluid").
  adFormat?: string;
  fullWidthResponsive?: boolean;
  // Fluid in-feed units also need a data-ad-layout-key (passed as a prop).
  fluid?: boolean;
};

const BLOCK: CSSProperties = { display: "block", width: "100%" };

export const AD_FORMAT_CONFIG: Record<AdFormat, AdFormatConfig> = {
  // Leaderboard banner: ~100px on mobile, 90px on desktop.
  [AdFormat.Banner]: {
    containerClassName: "w-full min-h-[100px] md:min-h-[90px]",
    insStyle: BLOCK,
    adFormat: "auto",
    fullWidthResponsive: true,
  },
  // In-content rectangle (300x250 MPU class).
  [AdFormat.Rectangle]: {
    containerClassName: "w-full min-h-[250px]",
    insStyle: BLOCK,
    adFormat: "auto",
    fullWidthResponsive: true,
  },
  // Desktop sidebar skyscraper (160x600 / 300x600 class).
  [AdFormat.Sidebar]: {
    containerClassName: "w-full min-h-[600px]",
    insStyle: BLOCK,
    adFormat: "auto",
  },
  // Mobile anchor: 50px small screens, up to ~100px larger.
  [AdFormat.Anchor]: {
    containerClassName: "w-full min-h-[50px] sm:min-h-[100px]",
    insStyle: BLOCK,
    adFormat: "auto",
    fullWidthResponsive: true,
  },
  // In-feed fluid row interleaved between content rows.
  [AdFormat.InFeed]: {
    containerClassName: "w-full min-h-[120px]",
    insStyle: { display: "block" },
    adFormat: "fluid",
    fluid: true,
  },
};
