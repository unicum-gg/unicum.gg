"use client";

import { DiscordLogoIcon, GithubLogoIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";
import { cn } from "@/lib/utils";
import { styles } from "@/lib/styles";
import { FooterBottomBar } from "./bottom-bar";
import { footerColumns } from "./nav";

export function Footer() {
  const spacerRef = useRef<HTMLDivElement>(null);
  // The `screen-line-after` on the spacer renders a 1px line at the bottom
  // of the spacer. When the spacer is collapsed (page tall enough that the
  // diagonal sits directly below the last Panel) the line stacks with the
  // Panel's own screen-line-after — both at 10% white compose to ~19% which
  // looks brighter than the rest of the site's 10% screen-lines. We only
  // render the line once the spacer has actual vertical room.
  const [showTopLine, setShowTopLine] = useState(false);
  const { region } = useRegion();

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
        <div className="grid grid-cols-2 gap-8 p-4 pb-8 sm:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 flex flex-col gap-4">
            <Link href={ROUTES.HOME(region)} className="flex items-center gap-2">
              <Image
                src="/icon.svg"
                alt=""
                width={24}
                height={24}
                className="size-6"
              />
              <span className="font-semibold">{APP.NAME}</span>
            </Link>
            <p className={`max-w-56 ${styles.mutedDescription}`}>
              Built for the World of Tanks community. Free stats for every
              player, clan, tank and map across EU, NA and Asia.
            </p>
            <div className="flex items-center gap-3">
              <SocialLink
                href={APP.EXTERNAL.DISCORD}
                label="Discord"
                icon={<DiscordLogoIcon weight="fill" className="size-5" />}
              />
              <SocialLink
                href={APP.EXTERNAL.GITHUB}
                label="GitHub"
                icon={<GithubLogoIcon weight="fill" className="size-5" />}
              />
            </div>
          </div>

          {footerColumns(region).map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-3 text-sm font-semibold">{column.title}</h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`text-sm ${styles.linkHover}`}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <FooterBottomBar />
      </footer>
    </div>
  );
}

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.linkHover}
    >
      {icon}
    </Link>
  );
}
