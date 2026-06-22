"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AD_FORMAT_CONFIG, AdFormat, adsEnabled, reservedHeightFor } from "./ad-config";
import { useAdSlotAllowed } from "./ad-density";
import { AD_NETWORK_SLOTS, activeAdNetwork } from "./ad-network";

/**
 * Start loading the unit once it is within this distance of the viewport. Keeps
 * below-fold units from competing with LCP (live LCP 938ms, UNI-13) while still
 * loading early enough that the user rarely sees an empty reserved box.
 */
const LAZY_LOAD_MARGIN = "300px";

interface AdSlotProps {
  /**
   * data-ad-slot id from the ad network dashboard. Placements pass a placeholder id
   * now and swap the real id once UNI-43 delivers it (no other code change needed).
   */
  slot: string;
  format: AdFormat;
  /** Required for in-feed fluid units (data-ad-layout-key from the network unit). */
  layoutKey?: string;
  /** Overrides data-full-width-responsive; defaults per format. */
  responsive?: boolean;
  className?: string;
}

/**
 * A deliberately placed, CLS-safe, consent-gated, network-agnostic ad display unit.
 *
 * AdSlot owns everything that does not depend on the ad network: reserved space
 * (CLS ~0), IntersectionObserver lazy-load (LCP protection), the NEXT_PUBLIC_ADS_ENABLED
 * flag + Consent Mode v2 gating, the density cap, and the "Advertisement" label. The
 * actual unit markup and activation come from the active network's adapter (see
 * ad-network.ts), so moving AdSense -> Ezoic -> Playwire is a config swap, not a rewrite
 * (the dominant revenue lever per the CMO model, UNI-47).
 *
 * Guarantees:
 *   - CLS ~0: the container reserves its final height before anything loads, so the
 *     ad never pushes content (Core Web Vitals / SEO deliverable, must stay CLS 0.00).
 *   - Lazy: the adapter only mounts (and pushes) once the slot is within ~300px of the
 *     viewport, so it never blocks LCP.
 *   - Consent-gated + density-capped (3 desktop / 2 mobile via AdDensityProvider).
 *
 * Renders nothing unless NEXT_PUBLIC_ADS_ENABLED === "true" (board sets it in prod once
 * real slot ids exist, UNI-43) and an adapter exists for the active network, so it ships
 * safely "dark" everywhere until then.
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

  const config = AD_FORMAT_CONFIG[format];
  const NetworkSlot = AD_NETWORK_SLOTS[activeAdNetwork()];
  const willLoad = allowed !== false && adsEnabled() && Boolean(NetworkSlot);

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

  if (!willLoad || !NetworkSlot) return null;

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
          <NetworkSlot
            slot={slot}
            format={format}
            layoutKey={layoutKey}
            responsive={isResponsive}
          />
        </>
      ) : null}
    </div>
  );
}
