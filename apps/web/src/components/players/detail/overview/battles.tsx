"use client";

import useSWR from "swr";
import { InfoIcon } from "@phosphor-icons/react";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { unicum } from "@/services/sdk";
import { useTranslation } from "@/hooks/use-translation";
import { PlayerBattlesTable, type PlayerBattleRow } from "./battles-table";

/**
 * The battles we know this player fought, newest first.
 *
 * **Every row here came from a player's own client, not from Wargaming.** The
 * API publishes an account's running totals and nothing about a single battle,
 * so this panel can only show what somebody who was in the battle chose to
 * share. A player's list therefore starts the day that began, and an empty one
 * means nobody has shared, not that they have not played.
 *
 * That is why the panel **disappears rather than showing an empty state**.
 * Most accounts on the site have nothing here and will not for a long time, and
 * a permanent "no battles yet" on two million player pages would read as the
 * site being broken rather than as a feature filling up. The sessions panel can
 * afford its empty state because it describes sampling we do ourselves, which
 * every account eventually gets; this describes other people's generosity.
 *
 * Fetched by the panel itself rather than threaded through the profile payload.
 * The page's own payload is cached and server-rendered, and battles move every
 * few minutes: a player checking their own page after a game would otherwise
 * read a list that was right when the page was built. Keyed on the SDK
 * request's own url, which is the pattern the rest of the profile uses for
 * anything it loads on demand.
 */
export function PlayerBattlesPanel({
  region,
  nickname,
  metric,
}: {
  region: Region;
  nickname: string;
  /** The reader's own metric, the one the rest of the profile is showing. */
  metric: RatingMetric;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const request = () => unicum.region(region).players(nickname).battles();
  const { data, isLoading } = useSWR(
    request().url(),
    () =>
      request().then(
        (r) =>
          r as unknown as { accountId: number; battles: PlayerBattleRow[] },
      ),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  // Nothing while it loads either: a panel that appears, shows a skeleton and
  // then vanishes for the overwhelming majority of accounts is worse than one
  // that arrives when it has something.
  if (isLoading || !data || data.battles.length === 0) return null;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {t("title", { nickname, count: data.battles.length })}
          </PanelTitle>
        </PanelHeader>
        {/* Said before the list, not under it. A reader who does not know
            where these rows come from will read an incomplete list as a
            complete one, and the gap is most of it: a battle is here only if
            somebody in it shared it. */}
        <PanelContent>
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span>{t("provenance")}</span>
          </p>
        </PanelContent>
        <PanelContent className="p-0">
          <PlayerBattlesTable
            region={region}
            nickname={nickname}
            metric={metric}
            accountId={data.accountId}
            battles={data.battles}
          />
        </PanelContent>
      </Panel>
    </>
  );
}
