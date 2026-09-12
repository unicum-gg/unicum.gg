"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerPanelList } from "@/components/entity/player-panel-list";
import type { Region } from "@unicum.gg/wargaming";
import type { PlayerTournamentTeammate } from "./row";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/**
 * Who this player competes with.
 *
 * The question the tournament record raises and that nothing upstream can
 * answer: Wargaming's tournament system is addressable from the tournament's
 * side only, so "who does this player enter with" exists nowhere until every
 * roster is in one place and the account ids on them can be matched against
 * each other. It is the same join that puts a tournament on a player's page at
 * all, turned sideways.
 *
 * Ordered by how often, not how recently, because the panel answers "who are
 * this player's people" rather than "who did they last play with". Each row
 * carries its own date so the reader can make that distinction: a standing
 * partner and a stranger from one night in 2022 are the same distance apart
 * when the count is small.
 */
export function TournamentTeammates({
  region,
  nickname,
  teammates,
}: {
  region: Region;
  nickname: string;
  teammates: PlayerTournamentTeammate[];
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/detail/tournaments/teammates");
  // Nothing to say for an account that has only ever entered solo formats, and
  // an empty panel reads as a section that failed rather than as an answer.
  if (teammates.length === 0) return null;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("teammates", { nickname })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-xs text-fd-muted-foreground">
              {t("everyone-who-has-shared-a", { nickname })}</p>
          </div>
          <PlayerPanelList
            region={region}
            entries={teammates.map((m) => ({
              key: m.accountId,
              lastAt: m.lastAt,
              value: num(INT_FORMAT).format(m.together),
              caption: "together",
              player: {
                nickname: m.nickname,
                accountId: m.accountId,
                clanTag: m.clanTag,
                clanColor: m.clanColor,
                isVerified: m.isVerified,
                isSupporter: m.isSupporter,
                twitchLogin: m.twitchLogin,
                tournamentWins: m.tournamentWins,
                tournamentFeaturedWins: m.tournamentFeaturedWins,
                tournamentBestTitle: m.tournamentBestTitle,
              },
            }))}
          />
        </PanelContent>
      </Panel>
    </>
  );
}
