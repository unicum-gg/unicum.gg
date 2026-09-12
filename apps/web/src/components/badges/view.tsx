"use client";

import { Interpolate } from "@/components/interpolate";
import { useTranslation } from "@/hooks/use-translation";
import type { ReactNode } from "react";
import Link from "@/components/link";
import {
  CLAN_BADGE_MAX_RANK,
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
const PLAYER_BADGE_COUNT = 7;

const CLAN_BOARDS = [
  { board: ClanBoard.Advances, tier: StrongholdTier.Advances },
  { board: ClanBoard.SkirmishT10, tier: StrongholdTier.T10 },
  { board: ClanBoard.SkirmishT8, tier: StrongholdTier.T8 },
  { board: ClanBoard.SkirmishT6, tier: StrongholdTier.T6 },
] as const;

/** The four board crests plus the tournament trophy in its two tinctures. */
const CLAN_BADGE_COUNT = CLAN_BOARDS.length + 2;

export function BadgesView() {
  const { t } = useTranslation("components/badges/view");
  const { t: tGame } = useTranslation("game/vocabulary");
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
            {t("n-badges", { count: PLAYER_BADGE_COUNT + CLAN_BADGE_COUNT })}
          </div>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            <Interpolate
              template={t("heading")}
              values={{
                badge: (
                  <span className="text-brand">{t("heading-accent")}</span>
                ),
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("the-marks-a-player-or", { NAME: APP.NAME })}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("player-badges")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-sm text-fd-muted-foreground">
              {t("marks-carried-beside-a-nickname", { NAME: APP.NAME })}</p>
          </div>
          <ul className="border-t border-fd-border">
            <BadgeRow
              crest={<Crest kind={CrestKind.Verified} size={20} />}
              name={t("verified.name")}
              how={t("verified.how")}
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.Supporter} size={20} />}
              name={t("supporter.name")}
              how={
                <Interpolate
                  template={t("supporter-note")}
                  values={{
                    link: (
                      <Link
                        href={ROUTES.SUPPORT}
                        className="underline underline-offset-2"
                      >
                        {t("support-subscription")}
                      </Link>
                    ),
                  }}
                />
              }
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.Streamer} size={20} />}
              name={t("streamer.name")}
              how={t("streamer.how")}
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.Tournament} size={20} />}
              name={t("tournament-winner.name")}
              how={t("tournament-winner.how")}
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.TournamentFeatured} size={20} />}
              name={t("featured-tournament-winner.name")}
              how={t("featured-tournament-winner.how")}
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.OnslaughtChampion} size={20} />}
              name={t("onslaught-champion.name")}
              how={
                <Interpolate
                  template={t("onslaught-champion.how")}
                  values={{
                    standings: (
                      <Link
                        href={ROUTES.PLAYERS_ONSLAUGHT(Region.EU)}
                        className="underline underline-offset-2"
                      >
                        {t("ranked-standings")}
                      </Link>
                    ),
                  }}
                />
              }
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.OnslaughtLegend} size={20} />}
              name={t("onslaught-legend.name")}
              how={t("onslaught-legend.how")}
            />
          </ul>
          <p className="border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
            <Interpolate
              template={t("player-overflow")}
              values={{ plus: <span className="font-medium">+N</span> }}
            />
          </p>
          <p className="border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
            {t("streamer-who-is-on-air")}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("clan-badges")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-sm text-fd-muted-foreground">
              {t("carried-beside-a-clan-tag")}</p>
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
                name={t("clan-board.name", {
                  board: tGame(`clan-boards.${board}`),
                  rank: CLAN_BADGE_MAX_RANK,
                })}
                how={
                  <Interpolate
                    template={t("clan-board.how")}
                    values={{
                      rank: CLAN_BADGE_MAX_RANK,
                      board: (
                        <Link
                          href={ROUTES.STRONGHOLD(Region.EU, tier)}
                          className="underline underline-offset-2"
                        >
                          {t("board-leaderboard", {
                            board: tGame(`clan-boards.${board}`),
                          })}
                        </Link>
                      ),
                    }}
                  />
                }
              />
            ))}
            <BadgeRow
              crest={<Crest kind={CrestKind.Tournament} size={20} />}
              name={t("tournament-winner.name")}
              how={t("tournament-winner.how")}
            />
            <BadgeRow
              crest={<Crest kind={CrestKind.TournamentFeatured} size={20} />}
              name={t("featured-tournament-winner.name")}
              how={t("featured-tournament-winner.how")}
            />
          </ul>
          <p className="border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
            <Interpolate
              template={t("clan-overflow")}
              values={{ plus: <span className="font-medium">+N</span> }}
            />
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
