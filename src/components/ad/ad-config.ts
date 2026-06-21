/**
 * AdSense publisher account (live plumbing in src/components/script/index.tsx,
 * Consent Mode v2 all-denied + Google Funding Choices CMP). Same client id the
 * adsbygoogle.js loader already uses; kept here so AdSlot can stamp the <ins>.
 */
export const AD_CLIENT = "ca-pub-3691404603790195";

/**
 * Each AdSlot is a deliberately placed display unit. Auto Ads / interstitial formats
 * are deliberately excluded: the dormant Auto Ads anchor is the artifact we are
 * removing (UNI-18), not a format we mount.
 */
export enum AdFormat {
  Banner = "banner",
  Rectangle = "rectangle",
  Sidebar = "sidebar",
  Anchor = "anchor",
  InFeed = "in-feed",
}

/**
 * Vertical space the label strip reserves above every unit (policy-compliant
 * "Advertisement" tag). Counted into the reserved height so the strip appearing
 * on load never shifts layout.
 */
export const AD_LABEL_HEIGHT = 16;

/**
 * Max units a single page may mount. Enforced by AdDensityProvider. No interstitials,
 * no auto-anchor: only these hand-placed slots count toward the cap.
 */
export const AD_MAX_UNITS = { desktop: 3, mobile: 2 } as const;

/** Below this viewport width a page is treated as mobile for the density cap. */
export const AD_DESKTOP_MIN_WIDTH = 768;

interface AdFormatConfig {
  /**
   * Reserved height for the ad unit itself, in px. We reserve the larger of the
   * mobile/desktop slot so the box never shifts across breakpoints (over-reserving
   * a few px never causes CLS; the unit just centers in the box).
   */
  reservedHeight: number;
  /** Renders sticky (sidebar rail). Placement supplies the scroll container. */
  sticky: boolean;
  /** data-ad-format on the <ins>: "fluid" for in-feed, "auto" otherwise. */
  adFormat: string;
  /** data-ad-layout on the <ins> (in-feed fluid units only). */
  adLayout?: string;
  /** Whether data-full-width-responsive defaults true for this format. */
  responsiveDefault: boolean;
}

/**
 * Per-format reserved space (CLS guard). Live CWV is CLS 0.00 (UNI-13) and must stay
 * 0.00: the container reserves final height before the unit loads so the ad never
 * pushes content. Heights track the rendered AdSense sizes from the placement spec
 * (banner 728x90 / mobile 50-100, rectangle 300x250, sidebar sticky, in-feed fluid).
 */
export const AD_FORMAT_CONFIG: Record<AdFormat, AdFormatConfig> = {
  [AdFormat.Banner]: {
    reservedHeight: 100,
    sticky: false,
    adFormat: "auto",
    responsiveDefault: true,
  },
  [AdFormat.Rectangle]: {
    reservedHeight: 250,
    sticky: false,
    adFormat: "auto",
    responsiveDefault: false,
  },
  [AdFormat.Sidebar]: {
    reservedHeight: 600,
    sticky: true,
    adFormat: "auto",
    responsiveDefault: false,
  },
  [AdFormat.Anchor]: {
    reservedHeight: 100,
    sticky: false,
    adFormat: "auto",
    responsiveDefault: true,
  },
  [AdFormat.InFeed]: {
    reservedHeight: 280,
    sticky: false,
    adFormat: "fluid",
    adLayout: "in-article",
    responsiveDefault: false,
  },
};

/**
 * Total reserved height for a format, including the label strip.
 */
export function reservedHeightFor(format: AdFormat): number {
  return AD_FORMAT_CONFIG[format].reservedHeight + AD_LABEL_HEIGHT;
}

/**
 * Master switch. Ads only render when NEXT_PUBLIC_ADS_ENABLED === "true", set by the
 * board in the prod environment after real data-ad-slot ids exist (UNI-43). Until then
 * every AdSlot renders nothing on every environment, so placements (UNI-40/41/42) can
 * ship now with placeholder slot ids and zero visual impact, then light up via one env
 * flip. The flag is intentionally kept OFF in dev/preview so a unit never fires there.
 */
export function adsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
}
