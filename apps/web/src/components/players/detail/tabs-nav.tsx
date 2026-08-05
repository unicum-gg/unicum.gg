"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  PLAYER_MODES,
  PLAYER_SECTIONS,
  PlayerMode,
  PlayerSection,
  playerModeHref,
  playerSectionHref,
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
export function PlayerSectionNav({
  basePath,
  section,
  tankCount,
  onSelect,
}: {
  basePath: string;
  section: PlayerSection;
  // Battle-having tank count, shown as "Tanks (N)". Comes from the detail
  // payload (a single number), not the on-demand /tanks list.
  tankCount: number;
  onSelect: (section: PlayerSection) => void;
}) {
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {PLAYER_SECTIONS.map((s) => (
        <NavAnchor
          key={s.id}
          href={playerSectionHref(basePath, s.id)}
          active={section === s.id}
          onActivate={() => {
            if (section !== s.id) onSelect(s.id);
          }}
        >
          {s.id === PlayerSection.Tanks
            ? `${s.label} (${tankCount.toLocaleString("en-US")})`
            : s.label}
        </NavAnchor>
      ))}
    </nav>
  );
}

// Bottom row: the battle-mode sub-tabs, shown only while the Overview section
// is active.
export function PlayerModeNav({
  basePath,
  mode,
  onSelect,
}: {
  basePath: string;
  mode: PlayerMode;
  onSelect: (mode: PlayerMode) => void;
}) {
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {PLAYER_MODES.map((m) => (
        <NavAnchor
          key={m.id}
          href={playerModeHref(basePath, m.id)}
          active={mode === m.id}
          onActivate={() => onSelect(m.id)}
        >
          {m.label}
        </NavAnchor>
      ))}
    </nav>
  );
}
