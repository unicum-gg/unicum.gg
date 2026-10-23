"use client";

import useSWR from "swr";
import { useLocale } from "@onruntime/translations/react";
import { ArrowRightIcon } from "@phosphor-icons/react";
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
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { numberFormat } from "@/lib/format";
import { PlayerSection, playerSectionHref } from "@/components/players/detail/tabs";
import { PlayerBattlesOffer } from "./battles-offer";
import { PlayerBattlesProvenance } from "./battles-provenance";
import { PlayerBattlesTable, type PlayerBattleRow } from "./battles-table";
import type { BattleFacets } from "@/components/players/detail/battles/filters";

export type PlayerBattlesPayload = {
  accountId: number;
  battles: PlayerBattleRow[];
  /** Every battle we hold for the account that matches the filters, across
   * all pages. */
  total: number;
  /** What the filters can offer, when the request asked for it. */
  facets?: BattleFacets;
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
 * That is why an empty list **offers the mod rather than saying "no battles
 * yet"**. Most accounts have nothing here and will not for a long time, and a
 * bare empty state on two million player pages would read as the site being
 * broken. Said as an offer instead, it names the one thing that fills it, on
 * the page a player is most likely to be reading: their own.
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

  // Nothing until there is an answer. A seeded panel has one from the first
  // paint, so this only waits when the server could not read the list, and a
  // request that failed says nothing either way about who has shared.
  if (!data) return null;
  const empty = data.battles.length === 0;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {t("title", { nickname, count: data.battles.length })}
          </PanelTitle>
        </PanelHeader>
        {empty ? (
          <PlayerBattlesOffer
            region={region}
            nickname={nickname}
            metric={metric}
          />
        ) : (
          <>
            <PlayerBattlesProvenance />
            <PanelContent className="p-0">
              <PlayerBattlesTable
                region={region}
                nickname={nickname}
                metric={metric}
                accountId={data.accountId}
                battles={data.battles}
              />
            </PanelContent>
            {/* Only when there is more than this panel shows. The tab holds
                every battle, a page at a time. */}
            {data.total > data.battles.length ? (
              <PanelContent className="border-t border-fd-border py-3">
                <Link
                  href={playerSectionHref(
                    ROUTES.PLAYER(region, nickname),
                    PlayerSection.Battles,
                  )}
                  className="text-fd-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  {t("see-all", {
                    count: numberFormat(locale).format(data.total),
                  })}
                  <ArrowRightIcon className="size-3.5" weight="bold" />
                </Link>
              </PanelContent>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}
