"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  CLAN_MODES,
  CLAN_SECTIONS,
  ClanMode,
  ClanSection,
  clanModeHref,
  clanSectionHref,
} from "./tabs";

// Returns true for a plain left click (the case we intercept for client-side
// nav). Modifier and middle clicks fall through so the anchor opens a new tab
// natively and stays deep-linkable.
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function NavAnchor({
  href,
  active,
  onActivate,
  children,
}: {
  href: string;
  active: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onActivate();
      }}
      className={cn(
        "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-fd-secondary/40 text-fd-foreground"
          : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
      )}
    >
      {children}
    </Link>
  );
}

// Top row: the profile sections. Clicking the section you're already in is a
// no-op. Each section is its own route, so switching lands on that section's
// default mode rather than carrying the current one over.
export function ClanSectionNav({
  basePath,
  section,
  onSelect,
  tankCount,
  videoCount,
}: {
  basePath: string;
  section: ClanSection;
  onSelect: (section: ClanSection) => void;
  // Distinct battle-having vehicle count, shown as "Tanks (N)" once loaded
  // (mirrors the player page). Undefined until the vehicles aggregation lands.
  tankCount?: number;
  // Published battles this clan is credited on. Undefined until the fetch
  // lands, which is why the tab is hidden rather than shown empty in the
  // meantime: appearing and then vanishing reads worse than appearing late.
  videoCount?: number;
}) {
  // Videos is shown even at zero, unlike the count-gated Tanks tab: an empty
  // video tab is an invitation for a clan's first tactic, not a dead end, and
  // the empty page is noindexed so it never competes as thin content.
  const sections = CLAN_SECTIONS;

  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {sections.map((s) => (
        <NavAnchor
          key={s.id}
          href={clanSectionHref(basePath, s.id)}
          active={section === s.id}
          onActivate={() => {
            if (section !== s.id) onSelect(s.id);
          }}
        >
          {s.id === ClanSection.Tanks && tankCount !== undefined
            ? `${s.label} (${tankCount.toLocaleString("en-US")})`
            : s.id === ClanSection.Videos && videoCount
              ? `${s.label} (${videoCount.toLocaleString("en-US")})`
              : s.label}
        </NavAnchor>
      ))}
    </nav>
  );
}

// Bottom row: the battle-mode sub-tabs, shown only while the Overview section
// is active.
export function ClanModeNav({
  basePath,
  mode,
  onSelect,
}: {
  basePath: string;
  mode: ClanMode;
  onSelect: (mode: ClanMode) => void;
}) {
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {CLAN_MODES.map((m) => (
        <NavAnchor
          key={m.id}
          href={clanModeHref(basePath, m.id)}
          active={mode === m.id}
          onActivate={() => onSelect(m.id)}
        >
          {m.label}
        </NavAnchor>
      ))}
    </nav>
  );
}
