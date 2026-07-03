"use client";

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
    <a
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
    </a>
  );
}

// Top row: the profile sections. Clicking the section you're already in is a
// no-op; switching keeps the current mode (see `clanSectionHref`).
export function ClanSectionNav({
  basePath,
  section,
  mode,
  onSelect,
}: {
  basePath: string;
  section: ClanSection;
  mode: ClanMode;
  onSelect: (section: ClanSection) => void;
}) {
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {CLAN_SECTIONS.map((s) => (
        <NavAnchor
          key={s.id}
          href={clanSectionHref(basePath, s.id, mode)}
          active={section === s.id}
          onActivate={() => {
            if (section !== s.id) onSelect(s.id);
          }}
        >
          {s.label}
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
