"use client";

import { useCookieConsent } from "@/contexts/cookie-consent";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export type AdSlotName =
  | "home-mid"
  | "home-bottom"
  | "page-top";

/**
 * Renders nothing unless NEXT_PUBLIC_ADS_ENABLED="true" at build time AND the
 * user has accepted cookie consent. When wiring an ad network (AdSense,
 * Mediavine, Nitro), drop the network's script tag in src/components/script,
 * then put the network's ins/iframe markup inside this component.
 */
export function AdSlot({
  slot,
  className,
}: {
  slot: AdSlotName;
  className?: string;
}) {
  const { hasConsent } = useCookieConsent();
  if (!ADS_ENABLED || !hasConsent) return null;
  return <div data-ad-slot={slot} className={className} />;
}
