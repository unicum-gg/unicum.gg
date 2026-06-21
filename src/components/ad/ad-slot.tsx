"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AD_CLIENT,
  AD_FORMAT_CONFIG,
  AdFormat,
  adsEnabled,
  reservedHeightFor,
} from "./ad-config";
import { useAdSlotAllowed } from "./ad-density";

/**
 * Start loading the unit once it is within this distance of the viewport. Keeps
 * below-fold units from competing with LCP (live LCP 938ms, UNI-13) while still
 * loading early enough that the user rarely sees an empty reserved box.
 */
const LAZY_LOAD_MARGIN = "300px";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdSlotProps {
  /**
   * data-ad-slot id from the AdSense dashboard. Placements pass a placeholder id now
   * and swap the real id once UNI-43 delivers it (no other code change needed).
   */
  slot: string;
  format: AdFormat;
  /** Required for in-feed fluid units (data-ad-layout-key from the AdSense unit). */
  layoutKey?: string;
  /** Overrides data-full-width-responsive; defaults per format. */
  responsive?: boolean;
  className?: string;
}

/**
 * A deliberately placed, CLS-safe, consent-gated AdSense display unit.
 *
 * Guarantees:
 *   - CLS ~0: the container reserves its final height before anything loads, so the
 *     ad never pushes content (Core Web Vitals / SEO deliverable, must stay CLS 0.00).
 *   - Lazy: the unit only pushes once it is within ~300px of the viewport, so it never
 *     blocks LCP.
 *   - Consent-gated: it reuses the existing Consent Mode v2 + Google Funding Choices
 *     plumbing in src/components/script/index.tsx. adsbygoogle queues the push; Consent
 *     Mode v2 gates the actual ad-server call until the CMP resolves consent (denied
 *     users still get non-personalized ads, which is the documented Google pattern).
 *     We never bypass Consent Mode.
 *   - Density-capped: respects AdDensityProvider (3 desktop / 2 mobile).
 *
 * Renders nothing unless NEXT_PUBLIC_ADS_ENABLED === "true" (board sets it in prod once
 * real slot ids exist, UNI-43), so it ships safely "dark" everywhere until then.
 */
export function AdSlot({
  slot,
  format,
  layoutKey,
  responsive,
  className,
}: AdSlotProps) {
  const allowed = useAdSlotAllowed();
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const pushedRef = useRef(false);

  const config = AD_FORMAT_CONFIG[format];
  const willLoad = allowed !== false && adsEnabled();

  useEffect(() => {
    if (!willLoad) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: LAZY_LOAD_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [willLoad]);

  useEffect(() => {
    if (!inView || pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js not ready yet, blocked, or consent path inactive. The reserved
      // box stays in place, so this is a safe no-op rather than an exception.
    }
  }, [inView]);

  if (!willLoad) return null;

  const isResponsive = responsive ?? config.responsiveDefault;

  return (
    <div
      ref={containerRef}
      data-ad-format={format}
      className={cn(
        "mx-auto flex w-full max-w-full flex-col items-center justify-start overflow-hidden",
        config.sticky && "sticky top-20",
        className,
      )}
      style={{ minHeight: reservedHeightFor(format) }}
    >
      {inView ? (
        <>
          <span className="block w-full text-center text-[10px] leading-4 tracking-wide text-muted-foreground uppercase">
            Advertisement
          </span>
          <ins
            className="adsbygoogle block"
            style={{
              display: "block",
              width: "100%",
              minHeight: config.reservedHeight,
            }}
            data-ad-client={AD_CLIENT}
            data-ad-slot={slot}
            data-ad-format={config.adFormat}
            {...(config.adLayout ? { "data-ad-layout": config.adLayout } : {})}
            {...(format === AdFormat.InFeed && layoutKey
              ? { "data-ad-layout-key": layoutKey }
              : {})}
            data-full-width-responsive={isResponsive ? "true" : "false"}
          />
        </>
      ) : null}
    </div>
  );
}
