"use client";

import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerPanelList } from "@/components/entity/player-panel-list";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";
import type {
  PlayerBattleEncounter,
  PlayerBattleEncounters,
} from "@unicum.gg/core/battles/met";
import type { BattleFilterState } from "./use-battle-filter";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DELTA_FORMAT = {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  signDisplay: "exceptZero",
} as const;

/**
 * Battles together before the difference against the usual rate is printed.
 * Below it a single win either way swings the figure by more than any player
 * could, and the row would be naming somebody on a coin toss. Even past it the
 * figure is a hint rather than a verdict, which the description says.
 */
const MIN_BATTLES_FOR_DELTA = 10;

/**
 * Who this player keeps meeting in battle, beside them and across from them.
 *
 * The battles list turned sideways, the way the tournament tab's teammates are
 * its rosters turned sideways. Follows the list's own filters, so narrowing it
 * to Onslaught answers "who do I meet in Onslaught". Read on its own request
 * rather than riding the list's, since it walks every battle the account has
 * while the list reads one page.
 */
export function BattleEncounters({
  region,
  nickname,
  filter,
  initial,
}: {
  region: Region;
  nickname: string;
  filter: BattleFilterState;
  /** The unfiltered answer, server-rendered with the page, so the panels are
   * there on arrival rather than a round trip after hydration. */
  initial: PlayerBattleEncounters | null;
}) {
  const request = () =>
    unicum.region(region).players(nickname).battlesPlayers(filter);
  const { data } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as PlayerBattleEncounters),
    {
      fallbackData: initial ?? undefined,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );
  if (!data) return null;
  return (
    <>
      <EncounterPanel
        region={region}
        nickname={nickname}
        entries={data.allies}
        side="allies"
      />
      <EncounterPanel
        region={region}
        nickname={nickname}
        entries={data.opponents}
        side="opponents"
      />
    </>
  );
}

function EncounterPanel({
  region,
  nickname,
  entries,
  side,
}: {
  region: Region;
  nickname: string;
  entries: PlayerBattleEncounter[];
  side: "allies" | "opponents";
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/detail/battles/encounters");
  // Nobody met twice is an answer about how few battles we hold, not about the
  // player, and an empty panel reads as a section that failed.
  if (entries.length === 0) return null;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t(`${side}.title`, { nickname })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-xs text-fd-muted-foreground">
              {t(`${side}.description`, { nickname })}
            </p>
          </div>
          <PlayerPanelList
            region={region}
            entries={entries.map((m) => ({
              key: m.accountId,
              lastAt: m.lastAt,
              value: num(INT_FORMAT).format(m.battles),
              caption:
                m.battles >= MIN_BATTLES_FOR_DELTA
                  ? t(`${side}.caption`, {
                      delta: num(DELTA_FORMAT).format(m.wins - m.expected),
                    })
                  : t("caption-few"),
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
                onslaughtBestTier: m.onslaughtBestTier,
                onslaughtBestRank: m.onslaughtBestRank,
                onslaughtSeasons: m.onslaughtSeasons,
              },
            }))}
          />
        </PanelContent>
      </Panel>
    </>
  );
}
