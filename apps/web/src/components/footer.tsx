"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { styles } from "@/lib/styles";
import { Region } from "@unicum.gg/wargaming";
import { FooterCoverageLink } from "./footer-coverage-link";

export function Footer() {
  const spacerRef = useRef<HTMLDivElement>(null);
  // The `screen-line-after` on the spacer renders a 1px line at the bottom
  // of the spacer. When the spacer is collapsed (page tall enough that the
  // diagonal sits directly below the last Panel) the line stacks with the
  // Panel's own screen-line-after — both at 10% white compose to ~19% which
  // looks brighter than the rest of the site's 10% screen-lines. We only
  // render the line once the spacer has actual vertical room.
  const [showTopLine, setShowTopLine] = useState(false);

  useEffect(() => {
    const el = spacerRef.current;
    if (!el) return;
    // Read the height from the observer entry (`contentRect`) instead of
    // `el.offsetHeight`: the latter forces a full-page synchronous reflow, and
    // on this tall/large DOM that showed up as the dominant layout-thrash cost
    // on load. The observer reports the measured size for free and its initial
    // callback fires after layout, so no forced reflow is triggered.
    const observer = new ResizeObserver((entries) => {
      setShowTopLine((entries[0]?.contentRect.height ?? 0) > 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        ref={spacerRef}
        className={cn("flex-1", styles.borderX, showTopLine && "screen-line-after")}
        aria-hidden
      />
      <div
        className={`relative flex h-8 w-full ${styles.borderX} diagonal-pattern`}
      />
      <footer className="screen-line-before border-x border-fd-border">
        <div className="space-y-3 p-4 text-center">
          <div className="text-sm text-fd-muted-foreground">
            Built for the World of Tanks community
          </div>
          {/* Footer links sit below the fold and are rarely the next click, so
              they warm on hover/focus rather than eagerly on viewport entry
              (see HoverPrefetchLink). GitHub is external, so it stays a plain
              Link (Next never prefetches cross-origin hrefs). */}
          <div className="flex justify-center gap-4 text-sm">
            <HoverPrefetchLink
              href={ROUTES.PLAYERS(Region.EU)}
              className={styles.linkHover}
            >
              Top players
            </HoverPrefetchLink>
            <HoverPrefetchLink
              href={ROUTES.CLANS(Region.EU)}
              className={styles.linkHover}
            >
              Top clans
            </HoverPrefetchLink>
            <HoverPrefetchLink
              href={ROUTES.TANKS(Region.EU)}
              className={styles.linkHover}
            >
              Top tanks
            </HoverPrefetchLink>
            <FooterCoverageLink />
            <HoverPrefetchLink href={ROUTES.SUPPORT} className={styles.linkHover}>
              Support
            </HoverPrefetchLink>
            <HoverPrefetchLink href={ROUTES.DOCS} className={styles.linkHover}>
              API Docs
            </HoverPrefetchLink>
            <HoverPrefetchLink href={ROUTES.MCP} className={styles.linkHover}>
              MCP
            </HoverPrefetchLink>
            <HoverPrefetchLink href={ROUTES.BOT} className={styles.linkHover}>
              Discord bot
            </HoverPrefetchLink>
            <Link
              href={APP.EXTERNAL.GITHUB}
              className={styles.linkHover}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
          </div>
          <div className="space-y-1 text-xs text-fd-muted-foreground">
            <div>© 2026 {APP.NAME}</div>
            <div>Not affiliated with Wargaming</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
