"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CLAN_BADGE_MAX_RANK,
  CLAN_BOARD_LABEL,
  ClanBoard,
  StrongholdTier,
} from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import { ClanRankBadge } from "@/components/entity/badges/clan-rank-badge";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import {
  PANEL_ROW_CLASS,
  PANEL_ROW_ICON_CELL_CLASS,
} from "@/components/entity/panel-row";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";

/**
 * What each badge is and how it is earned.
 *
 * CRESTS only, and that is the page's scope rather than an oversight. The site
 * carries other marks beside a name or a tag: the roster boost warning on a
 * clan, the Common Test flag on a map or a vehicle. Neither is an honour and
 * neither is earned, so neither belongs on a page a reader opens to find out
 * what to go and win.
 *
 * Written from the rules the code applies rather than from an idea of them:
 * every line corresponds to a condition in `resolvePlayerBadges`,
 * `resolveClanBadges` or the winners pass, and states something a reader could
 * go and check. A page promising a badge the site does not award would be worse
 * than no page at all.
 *
 * The crests are rendered, not described. They are 16px marks a reader has seen
 * beside a nickname without necessarily knowing what they meant, so the point
 * is to put the mark and its meaning on one line.
 *
 * A client component, and it has to be: the clan rank crests carry tooltips,
 * which are client primitives, and rendering them from the server produced a
 * tree the client could not hydrate, so the crest appeared in the HTML and
 * vanished on hydration. The player rows escaped it only because they draw the
 * bare `Crest` rather than the tooltip-wrapped badges.
 *
 * The live pill is deliberately absent: it is not a badge but a state, it
 * resolves per account from the streamers stream, and there is no account to
 * resolve on a page about badges in general. It is described in words instead.
 */
function BadgeRow({
  crest,
  name,
  how,
}: {
  crest: ReactNode;
  name: string;
  how: ReactNode;
}) {
  return (
    <li className={PANEL_ROW_CLASS}>
      <span className={PANEL_ROW_ICON_CELL_CLASS}>{crest}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-sm text-fd-muted-foreground">{how}</div>
      </div>
    </li>
  );
}

/** Counted rather than typed, so the hero cannot drift from the list. */
const PLAYER_BADGE_COUNT = 5;

const CLAN_BOARDS = [
  { board: ClanBoard.Advances, tier: StrongholdTier.Advances },
  { board: ClanBoard.SkirmishT10, tier: StrongholdTier.T10 },
  { board: ClanBoard.SkirmishT8, tier: StrongholdTier.T8 },
  { board: ClanBoard.SkirmishT6, tier: StrongholdTier.T6 },
] as const;

/** The four board crests plus the tournament trophy in its two tinctures. */
const CLAN_BADGE_COUNT = CLAN_BOARDS.length + 2;

export function BadgesView() {
  return (
    // The page container every other standalone page uses, so the panels sit in
    // the same column as the glossary and the support page rather than running
    // edge to edge.
    <div className="mx-auto w-full max-w-7xl">
      {/* The hero every standalone page opens on, so this one is introduced
          rather than starting mid-list. The count is computed from the rows
          below, not typed, so adding a badge cannot leave the number wrong. */}
      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 text-sm tracking-wide text-fd-muted-foreground uppercase">
            {PLAYER_BADGE_COUNT + CLAN_BADGE_COUNT} badges
          </div>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Every <span className="text-brand">badge</span> and how to earn it
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            The marks a player or a clan can carry on {APP.NAME}, what each one
            says, and exactly what it takes to get it.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Player badges</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-sm text-fd-muted-foreground">
              Marks carried beside a nickname wherever it appears on {APP.NAME}:
              leaderboards, clan rosters, search, tournament brackets.
            </p>
          </div>
          <ul className="border-t border-fd-border">
            <BadgeRow
              crest={<Crest kind={CrestKind.Verified} size={20} />}
              name="Verified"
              how="The owner has signed in with their Wargaming.net ID and connected this account. Signing in is the whole requirement, and it costs nothing."
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.Supporter} size={20} />}
              name="Supporter"
              how={
                <>
                  An active{" "}
                  <Link
                    href={ROUTES.SUPPORT}
                    className="underline underline-offset-2"
                  >
                    support subscription
                  </Link>
                  , kept public. Supporters who choose to stay anonymous carry no
                  badge, by their own choice.
                </>
              }
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.Streamer} size={20} />}
              name="Streamer"
              how="A Twitch channel linked to the account. Connect Twitch on your own profile to confirm it, and the crest links to your channel. It shows whether or not you are live."
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.Tournament} size={20} />}
              name="Tournament winner"
              how="Was on the roster of a team that finished first in a settled Wargaming tournament. Read from the mirrored brackets, so a win from 2018 counts like one from last night."
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.TournamentFeatured} size={20} />}
              name="Featured tournament winner"
              how="The same, won at an event Wargaming itself flags as featured: the branded championships and their qualifiers rather than the nightly ladders. Gold instead of steel."
            />
          </ul>
          <p className="border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
            A streamer who is on air also carries a red LIVE pill. That one is
            not earned and not kept: it appears when the stream starts and goes
            when it ends.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Clan badges</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-sm text-fd-muted-foreground">
              Carried beside a clan tag. A rank crest is a place in a
              competition: the number on it is that place, its colour says which
              board. Ratings earn none, because being high on WN8 is not
              something a clan wins.
            </p>
          </div>
          <ul className="border-t border-fd-border">
            {CLAN_BOARDS.map(({ board, tier }) => (
              <BadgeRow
                key={board}
                crest={
                  <ClanRankBadge
                    badge={{ board, rank: 1 }}
                    region={Region.EU}
                    size={20}
                  />
                }
                name={`${CLAN_BOARD_LABEL[board]}, top ${CLAN_BADGE_MAX_RANK}`}
                how={
                  <>
                    A place in the top {CLAN_BADGE_MAX_RANK} of the{" "}
                    <Link
                      href={ROUTES.STRONGHOLD(Region.EU, tier)}
                      className="underline underline-offset-2"
                    >
                      {CLAN_BOARD_LABEL[board]} leaderboard
                    </Link>
                    . Held while the clan holds the place, and lost when it does
                    not.
                  </>
                }
              />
            ))}
            <BadgeRow
              crest={<Crest kind={CrestKind.Tournament} size={20} />}
              name="Tournament winner"
              how="A team attributed to the clan won a tournament. Wargaming records teams and accounts, never clans, so the attribution is recovered by matching each roster against clan membership as it stood on the day it was played."
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.TournamentFeatured} size={20} />}
              name="Featured tournament winner"
              how="The same, won at an event Wargaming flags as featured. Gold instead of steel, exactly as on the player side."
            />
          </ul>
          <p className="border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
            A clan holding more than three places folds the rest into a{" "}
            <span className="font-medium">+N</span> crest, best first, so the tag
            stays readable. Hovering it names them.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
