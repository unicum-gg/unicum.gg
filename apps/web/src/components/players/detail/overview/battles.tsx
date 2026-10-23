"use client";

import useSWR from "swr";
import { useLocale } from "@onruntime/translations/react";
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

export type PlayerBattlesPayload = {
  accountId: number;
  battles: PlayerBattleRow[];
};

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
 * Seeded by the server and refetched on mount, rather than one or the other.
 * Fetched only in the browser, the panel could not exist before hydration plus
 * a round trip to the endpoint (~0.5s), so it popped in late and pushed the
 * page down. Seeded only, it would show the list as it stood when the page was
 * cached, up to a day old, while battles move every few minutes. So the cached
 * HTML carries the list it was built with and the browser swaps in the current
 * one, keyed on the SDK request's own url like everything else the profile
 * loads on demand.
 */
export function PlayerBattlesPanel({
  region,
  nickname,
  metric,
  initialBattles,
}: {
  region: Region;
  nickname: string;
  /** The reader's own metric, the one the rest of the profile is showing. */
  metric: RatingMetric;
  /** The list the server rendered the page with, null when it did not ask. */
  initialBattles: PlayerBattlesPayload | null;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const { locale } = useLocale();
  // In the page's own language, which is also what the server seeded it with,
  // so the seed and the refetch share one key.
  const request = () =>
    unicum.region(region).players(nickname).battles({ language: locale });
  const { data } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as PlayerBattlesPayload),
    {
      fallbackData: initialBattles ?? undefined,
      // Explicit, because the seed can be a day old: the cached HTML is only
      // what to show until the current list arrives.
      revalidateOnMount: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  // Nothing while it loads either: a panel that appears, shows a skeleton and
  // then vanishes for the overwhelming majority of accounts is worse than one
  // that arrives when it has something. A seeded panel has data from the first
  // paint, so this only waits on a view the server did not render the list for.
  if (!data || data.battles.length === 0) return null;

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
