"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import Link from "@/components/link";
import { usePathname } from "@/hooks/use-pathname";
import type { MouseEvent } from "react";
import { TabBar, tabItemClass } from "@/components/ui/tab-bar";
import {
  PLAYER_MODES,
  PLAYER_SECTIONS,
  isArchivedPlayerMode,
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
      // A tab bar is a row of whole pages. Nothing in this tree draws a
      // loading boundary, so each one Next prefetched on sight was the
      // destination in full: measured on the tanks index, 1.8 MB of them.
      // See `prefetch` in `@/components/link`.
      prefetch="intent"
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onActivate();
      }}
      className={tabItemClass(active)}
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
  tournamentCount,
  battleCount,
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
  // Tournaments entered, shown as "Tournaments (N)". Omitted from the label at
  // zero rather than printed as "(0)", unlike the two above: almost no account
  // has ever entered one, so a count there would be a column of zeroes across
  // the site saying nothing.
  tournamentCount: number;
  // Battles shared through the mod, shown as "Battles (N)". Omitted at zero
  // like the tournaments, and for the same reason: most accounts have none.
  battleCount: number;
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
    ...(tournamentCount > 0
      ? { [PlayerSection.Tournaments]: tournamentCount }
      : {}),
    ...(battleCount > 0 ? { [PlayerSection.Battles]: battleCount } : {}),
  };
  // Sections still being shaped. Same idea as `counts`: adding or removing a
  // beta flag is one entry, and deleting the entry is the whole rollout step.
  const beta = new Set<PlayerSection>([PlayerSection.Value]);
  return (
    <TabBar>
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
    </TabBar>
  );
}

// Bottom row: the battle-mode sub-tabs, shown only while the Overview section
// is active.
//
// The longest row on the site, and the reason `TabBar` matters here: ten modes
// already overflowed a 1512px viewport by 68px in French, and the five ended
// ones take it to fifteen for the accounts that played them. The rail shows an
// arrow where a bare `overflow-x-auto` clipped the last tab mid-word with
// nothing to say it was there.
export function PlayerModeNav({
  basePath,
  mode,
  played,
  onSelect,
}: {
  basePath: string;
  mode: PlayerMode;
  /** The finished modes this account has a record in. The others are never
   * offered: nobody can add to them, so "no data yet, check back" would be a
   * lie. The mode currently open is always kept, so a link to one stays
   * readable. See `isArchivedPlayerMode`. */
  played: ReadonlySet<PlayerMode>;
  onSelect: (mode: PlayerMode) => void;
}) {
  const { t } = useTranslation("game/vocabulary");
  const shown = PLAYER_MODES.filter(
    (m) =>
      !isArchivedPlayerMode(m.id) || played.has(m.id) || mode === m.id,
  );

  return (
    <TabBar>
      {shown.map((m) => (
        <NavAnchor
          key={m.id}
          href={playerModeHref(basePath, m.id)}
          active={mode === m.id}
          onActivate={() => onSelect(m.id)}
        >
          {t(`player-modes.${m.id}`)}
        </NavAnchor>
      ))}
    </TabBar>
  );
}
