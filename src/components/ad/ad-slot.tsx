"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle: object[];
  }
}

export enum AdFormat {
  Banner = "banner",
  Rectangle = "rectangle",
  Sidebar = "sidebar",
  Anchor = "anchor",
  InFeed = "in-feed",
}

const RESERVED_HEIGHT: Record<AdFormat, string> = {
  [AdFormat.Banner]: "min-h-[90px]",
  [AdFormat.Rectangle]: "min-h-[250px]",
  [AdFormat.Sidebar]: "min-h-[250px]",
  [AdFormat.Anchor]: "min-h-[50px]",
  [AdFormat.InFeed]: "min-h-[90px]",
};

export function AdSlot({
  slot,
  format,
  layoutKey,
  className,
}: {
  slot: string;
  format: AdFormat;
  layoutKey?: string;
  className?: string;
}) {
  const insRef = useRef<HTMLInsElement>(null);
  const didPush = useRef(false);

  useEffect(() => {
    const el = insRef.current;
    if (!el || didPush.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || didPush.current) return;
        didPush.current = true;
        observer.disconnect();
        try {
          // adsbygoogle queues pushes; Consent Mode v2 (already wired in
          // src/components/script/index.tsx) gates actual ad-server calls
          // until the user grants consent via the CMP.
          window.adsbygoogle = window.adsbygoogle ?? [];
          window.adsbygoogle.push({});
        } catch {
          // adsbygoogle not loaded on non-Google-CMP pages
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return null;

  return (
    <div
      className={cn(
        "overflow-hidden bg-transparent",
        RESERVED_HEIGHT[format],
        className,
      )}
    >
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client="ca-pub-3691404603790195"
        data-ad-slot={slot}
        data-ad-format={format === AdFormat.InFeed ? "fluid" : "auto"}
        data-ad-layout={format === AdFormat.InFeed ? "in-article" : undefined}
        data-ad-layout-key={
          format === AdFormat.InFeed ? layoutKey : undefined
        }
        data-full-width-responsive={
          format === AdFormat.Banner ? "true" : undefined
        }
      />
    </div>
  );
}
