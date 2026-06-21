"use client";

import { useEffect, useRef, useState } from "react";
import { env } from "env";
import { cn } from "@/lib/utils";
import { AD_CLIENT, AD_FORMAT_CONFIG, type AdFormat } from "./ad-config";
import { useAdConsent } from "./use-ad-consent";

type AdsByGoogleWindow = Window & { adsbygoogle?: unknown[] };

export type AdUnitProps = {
  // data-ad-slot id provisioned in the AdSense console (UNI-43 / UNI-18b).
  slot: string;
  format: AdFormat;
  // Page + region context, surfaced as data-* attributes for reporting.
  page?: string;
  region?: string;
  // Required for fluid in-feed units (data-ad-layout-key).
  layoutKey?: string;
  className?: string;
};

/**
 * Single CLS-safe ad primitive every placement renders through.
 *
 * - Reserved space: the container reserves explicit min-height per breakpoint
 *   via CSS before the ad loads, and clips overflow, so consent/fill cause
 *   zero layout shift.
 * - Lazy-load: the <ins> is only mounted and pushed once the unit is within
 *   ~200px of the viewport. Offscreen units never load (protects LCP/CWV).
 * - Consent-gated: nothing is pushed to adsbygoogle until Consent Mode v2
 *   ad_storage resolves to granted (see `useAdConsent`). No ad request fires
 *   pre-consent.
 * - Feature flag: NEXT_PUBLIC_ADS_ENABLED. When off, only the reserved box
 *   renders so this can merge and deploy dark before live slot ids exist.
 */
export function AdUnit({
  slot,
  format,
  page,
  region,
  layoutKey,
  className,
}: AdUnitProps) {
  const config = AD_FORMAT_CONFIG[format];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [inView, setInView] = useState(false);
  const consentGranted = useAdConsent();

  const enabled = env.NEXT_PUBLIC_ADS_ENABLED;
  const shouldRenderIns = enabled && inView && consentGranted;

  useEffect(() => {
    if (!enabled || inView) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, inView]);

  useEffect(() => {
    if (!shouldRenderIns || pushedRef.current || !insRef.current) return;
    try {
      const w = window as AdsByGoogleWindow;
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // adsbygoogle.js not yet evaluated, or the slot is already filled.
      // Both are benign: the loader drains the queue once present.
    }
  }, [shouldRenderIns]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "block overflow-hidden",
        config.containerClassName,
        className,
      )}
      data-ad-unit-format={format}
      data-ad-page={page}
      data-ad-region={region}
    >
      {shouldRenderIns ? (
        <ins
          ref={insRef}
          className="adsbygoogle block"
          style={config.insStyle}
          data-ad-client={AD_CLIENT}
          data-ad-slot={slot}
          {...(config.adFormat ? { "data-ad-format": config.adFormat } : {})}
          {...(config.fullWidthResponsive
            ? { "data-full-width-responsive": "true" }
            : {})}
          {...(config.fluid && layoutKey
            ? { "data-ad-layout-key": layoutKey }
            : {})}
        />
      ) : null}
    </div>
  );
}
