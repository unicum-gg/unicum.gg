"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import Link from "@/components/link";
import { usePathname } from "@/hooks/use-pathname";
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
export function PlayerSectionNav({
  basePath,
  section,
  tankCount,
  achievementCount,
  onSelect,
}: {
  basePath: string;
  section: PlayerSection;
  // Battle-having tank count, shown as "Tanks (N)". Comes from the detail
  // payload (a single number), not the on-demand /tanks list.
  tankCount: number;
  // Distinct medals earned, shown as "Achievements (N)". Same deal: it rides in
  // the detail payload so the label is right on every section, not only once
  // the (heavy) achievements list has been fetched.
  achievementCount: number;
  onSelect: (section: PlayerSection) => void;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/detail/tabs");
  const pathname = usePathname();
  // One count per section rather than a chain of ternaries in the JSX, so a
  // third counted section is a line here instead of another special case.
  const counts: Partial<Record<PlayerSection, number>> = {
    [PlayerSection.Tanks]: tankCount,
    [PlayerSection.Achievements]: achievementCount,
  };
  // Sections still being shaped. Same idea as `counts`: adding or removing a
  // beta flag is one entry, and deleting the entry is the whole rollout step.
  const beta = new Set<PlayerSection>([PlayerSection.Value]);
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {PLAYER_SECTIONS.map((s) => (
        <NavAnchor
          key={s}
          href={playerSectionHref(basePath, s)}
          active={section === s}
          onActivate={() => {
            // Compared on the URL, not on the section: a vehicle record lives
            // under Tanks at a deeper path (`/tanks/is-7`), so "already on this
            // section" would swallow the one click that closes it and leave no
            // way back to the plain list.
            if (pathname !== playerSectionHref(basePath, s)) onSelect(s);
          }}
        >
          {counts[s] !== undefined
            ? t("section-count", {
                section: t(`sections.${s}`),
                count: numberFormat(locale).format(counts[s]!),
              })
            : t(`sections.${s}`)}
          {beta.has(s) && (
            <span className="ml-1.5 rounded-sm bg-fd-secondary px-1 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-fd-muted-foreground uppercase">
              {t("beta")}
            </span>
          )}
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
  const { t } = useTranslation("game/vocabulary");

  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {PLAYER_MODES.map((m) => (
        <NavAnchor
          key={m.id}
          href={playerModeHref(basePath, m.id)}
          active={mode === m.id}
          onActivate={() => onSelect(m.id)}
        >
          {t(`player-modes.${m.id}`)}
        </NavAnchor>
      ))}
    </nav>
  );
}
