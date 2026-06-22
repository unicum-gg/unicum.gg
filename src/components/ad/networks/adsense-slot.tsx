"use client";

import { useEffect, useRef } from "react";
import { AD_CLIENT, AD_FORMAT_CONFIG, AdFormat } from "../ad-config";
import type { AdNetworkSlotProps } from "../ad-network";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * AdSense network adapter. Renders the <ins class="adsbygoogle"> unit and queues the
 * push. AdSlot only mounts this once the slot is in view and ads are enabled, so the
 * push is inherently lazy. adsbygoogle queues the push; Consent Mode v2 (existing
 * plumbing in src/components/script/index.tsx) gates the actual ad-server call, so
 * denied users still get non-personalized ads and consent is never bypassed.
 */
export function AdSenseSlot({
  slot,
  format,
  layoutKey,
  responsive,
}: AdNetworkSlotProps) {
  const config = AD_FORMAT_CONFIG[format];
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js not ready yet, blocked, or consent path inactive. AdSlot's
      // reserved box stays in place, so this is a safe no-op rather than an exception.
    }
  }, []);

  return (
    <ins
      className="adsbygoogle block"
      style={{ display: "block", width: "100%", minHeight: config.reservedHeight }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={slot}
      data-ad-format={config.adFormat}
      {...(config.adLayout ? { "data-ad-layout": config.adLayout } : {})}
      {...(format === AdFormat.InFeed && layoutKey
        ? { "data-ad-layout-key": layoutKey }
        : {})}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
