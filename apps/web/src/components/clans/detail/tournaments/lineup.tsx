"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerPanelList } from "@/components/entity/player-panel-list";
import type { Region } from "@unicum.gg/wargaming";
import type { ClanTournamentPlayer } from "./row";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Which of the clan's own members to field.
 *
 * The clan page already says who is IN the clan. This says which of them turns
 * up to compete and which of them wins, which is the question a captain
 * building a line-up actually has, and it is answerable only because the
 * mirrored rosters carry account ids: Wargaming's tournament system knows teams
 * and accounts, never clans.
 *
 * The record shown is each player's WHOLE record, not what they won wearing
 * this tag. Someone picking a line-up is judging the player, and a title won in
 * a previous clan says as much about them as one won here.
 */
export function ClanTournamentLineup({
  region,
  tag,
  players,
}: {
  region: Region;
  tag: string;
  players: ClanTournamentPlayer[];
}) {
  // A clan whose members have never entered one has nothing to show, and an
  // empty panel reads as a section that failed rather than as an answer.
  if (players.length === 0) return null;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>[{tag}] tournament players</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-xs text-fd-muted-foreground">
              Members who compete: those who have won one first, then the most
              active. Their whole record, not only what they did with this clan.
            </p>
          </div>
          <PlayerPanelList
            region={region}
            entries={players.map((p) => ({
              key: p.accountId,
              lastAt: p.lastAt,
              // A winner leads with their titles, against the entries that put
              // them in perspective: six wins from 87 is a better record than
              // thirteen from 1,359, and a lone total would rank them the other
              // way round. Everyone else leads with how much they play, because
              // that is their claim. A "0" announced the one thing they have
              // not done and hid the one thing they have.
              value: intFmt.format(p.wins > 0 ? p.wins : p.entered),
              caption: p.wins > 0 ? `of ${intFmt.format(p.entered)}` : "entered",
              player: {
                nickname: p.nickname,
                accountId: p.accountId,
                isVerified: p.isVerified,
                isSupporter: p.isSupporter,
                twitchLogin: p.twitchLogin,
                tournamentWins: p.wins,
                tournamentFeaturedWins: p.featuredWins,
                tournamentBestTitle: p.tournamentBestTitle,
              },
            }))}
          />
        </PanelContent>
      </Panel>
    </>
  );
}
