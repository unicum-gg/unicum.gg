"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import Link from "@/components/link";
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
import { useTranslation } from "@/hooks/use-translation";

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
  // lands, and the label is the only thing that waits on it: the tab is offered
  // either way, so nothing appears and then vanishes.
  videoCount?: number;
}) {
  const { locale } = useLocale();
  // Videos is shown even at zero, unlike the count-gated Tanks tab: an empty
  // video tab is an invitation for a clan's first tactic, not a dead end, and
  // the empty page is noindexed so it never competes as thin content.
  const { t } = useTranslation("components/clans/detail/tabs");

  // A count rides the label only where one is known: Tanks always carries it,
  // Videos only once there is something to count.
  function label(id: ClanSection, locale: string): string {
    const name = t(`sections.${id}`);
    const count =
      id === ClanSection.Tanks && tankCount !== undefined
        ? tankCount
        : id === ClanSection.Videos && videoCount
          ? videoCount
          : null;
    return count === null
      ? name
      : t("section-count", {
          section: name,
          count: numberFormat(locale).format(count),
        });
  }

  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {CLAN_SECTIONS.map((id) => (
        <NavAnchor
          key={id}
          href={clanSectionHref(basePath, id)}
          active={section === id}
          onActivate={() => {
            if (section !== id) onSelect(id);
          }}
        >
          {label(id, locale)}
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
  const { t: tGame } = useTranslation("game/vocabulary");

  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {CLAN_MODES.map((m) => (
        <NavAnchor
          key={m.id}
          href={clanModeHref(basePath, m.id)}
          active={mode === m.id}
          onActivate={() => onSelect(m.id)}
        >
          {tGame(`clan-modes.${m.id}`)}
        </NavAnchor>
      ))}
    </nav>
  );
}
