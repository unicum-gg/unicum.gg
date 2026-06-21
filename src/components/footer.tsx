"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { styles } from "@/lib/styles";
import { Region } from "@/services/wargaming/wot";
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
    const update = () => setShowTopLine(el.offsetHeight > 0);
    update();
    const observer = new ResizeObserver(update);
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
          <div className="flex justify-center gap-4 text-sm">
            <Link
              href={ROUTES.TOP(Region.EU)}
              className={styles.linkHover}
            >
              Leaderboards
            </Link>
            <Link
              href={ROUTES.PLAYERS(Region.EU)}
              className={styles.linkHover}
            >
              Top players
            </Link>
            <Link
              href={ROUTES.CLANS(Region.EU)}
              className={styles.linkHover}
            >
              Top clans
            </Link>
            <Link href={ROUTES.GLOSSARY} className={styles.linkHover}>
              Glossary
            </Link>
            <FooterCoverageLink />
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
