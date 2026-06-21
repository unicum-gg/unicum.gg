"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AD_CLIENT,
  AD_FORMAT_CONFIG,
  AD_SLOT_IDS,
  AdFormat,
  isAdsActive,
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
  format: AdFormat;
  /** data-full-width-responsive on the unit. Defaults to true. */
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
 *   - Consent-gated: it reuses the existing prod-only Consent Mode v2 + Google Funding
 *     Choices plumbing in src/components/script/index.tsx. We never bypass Consent Mode;
 *     the push only happens in production where adsbygoogle.js and the CMP are active.
 *   - Density-capped: respects AdDensityProvider (3 desktop / 2 mobile).
 *
 * When no data-ad-slot id is configured for the format the slot ships "dark": it still
 * reserves space (stable layout) but never pushes, so ids can drop in later (UNI-43)
 * with zero layout shift and no code change.
 */
export function AdSlot({ format, responsive = true, className }: AdSlotProps) {
  const allowed = useAdSlotAllowed();
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const pushedRef = useRef(false);

  const config = AD_FORMAT_CONFIG[format];
  const slotId = AD_SLOT_IDS[format];
  const willLoad = allowed !== false && isAdsActive() && Boolean(slotId);

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

  if (allowed === false) return null;

  return (
    <div
      ref={containerRef}
      data-ad-format={format}
      aria-hidden={!willLoad}
      className={cn(
        "mx-auto flex w-full max-w-full flex-col items-center justify-start overflow-hidden",
        config.sticky && "sticky top-20",
        className,
      )}
      style={{ minHeight: reservedHeightFor(format) }}
    >
      {inView && slotId ? (
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
            data-ad-slot={slotId}
            data-ad-format={config.adFormat}
            {...(config.adLayout ? { "data-ad-layout": config.adLayout } : {})}
            data-full-width-responsive={responsive ? "true" : "false"}
          />
        </>
      ) : null}
    </div>
  );
}
