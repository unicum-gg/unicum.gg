import { env } from "env";

/**
 * AdSense publisher account (live plumbing in src/components/script/index.tsx,
 * Consent Mode v2 all-denied + Google Funding Choices CMP). Same client id the
 * adsbygoogle.js loader already uses; kept here so AdSlot can stamp the <ins>.
 */
export const AD_CLIENT = "ca-pub-3691404603790195";

/**
 * Each AdSlot is a deliberately placed display unit. Auto Ads / anchor / interstitial
 * formats are deliberately excluded: the dormant Auto Ads anchor is the artifact we are
 * removing (UNI-18), not a format we mount.
 */
export enum AdFormat {
  Leaderboard = "leaderboard",
  InFeed = "in-feed",
  Sidebar = "sidebar",
  Anchor = "anchor",
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
  /** data-ad-format on the <ins>. */
  adFormat: string;
  /** data-ad-layout on the <ins> (fluid / in-feed units only). */
  adLayout?: string;
}

/**
 * Per-format reserved space (CLS guard). Live CWV is CLS 0.00 (UNI-13) and must stay
 * 0.00: the container reserves final height before the unit loads so the ad never
 * pushes content. Heights track the rendered AdSense sizes from the placement spec
 * (leaderboard 90 desktop / 50-100 mobile, in-feed 280, sidebar 600 sticky).
 */
export const AD_FORMAT_CONFIG: Record<AdFormat, AdFormatConfig> = {
  [AdFormat.Leaderboard]: { reservedHeight: 100, sticky: false, adFormat: "auto" },
  [AdFormat.InFeed]: {
    reservedHeight: 280,
    sticky: false,
    adFormat: "fluid",
    adLayout: "in-article",
  },
  [AdFormat.Sidebar]: { reservedHeight: 600, sticky: true, adFormat: "auto" },
  [AdFormat.Anchor]: { reservedHeight: 100, sticky: false, adFormat: "auto" },
};

/**
 * Real data-ad-slot ids come from the AdSense dashboard (board action, UNI-43) and
 * drop in via env without a code change. When an id is absent the slot still reserves
 * its space (stable layout) but never pushes, so it ships "dark" until ids land.
 */
export const AD_SLOT_IDS: Record<AdFormat, string | undefined> = {
  [AdFormat.Leaderboard]: env.NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD,
  [AdFormat.InFeed]: env.NEXT_PUBLIC_ADSENSE_SLOT_IN_FEED,
  [AdFormat.Sidebar]: env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
  [AdFormat.Anchor]: env.NEXT_PUBLIC_ADSENSE_SLOT_ANCHOR,
};

/**
 * Total reserved height for a format, including the label strip.
 */
export function reservedHeightFor(format: AdFormat): number {
  return AD_FORMAT_CONFIG[format].reservedHeight + AD_LABEL_HEIGHT;
}

/**
 * The ad path is active only in production, mirroring the prod-only gate in
 * src/components/script/index.tsx that loads adsbygoogle.js and the Consent Mode v2
 * defaults. Outside production we reserve space but never push, so we never bypass
 * Consent Mode and never fire a unit in dev.
 */
export function isAdsActive(): boolean {
  return process.env.NODE_ENV === "production";
}
