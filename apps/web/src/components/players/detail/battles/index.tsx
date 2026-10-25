"use client";

import useSWR from "swr";
import { useState } from "react";
import { useLocale } from "@onruntime/translations/react";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TablePager } from "@/components/table-pager";
import { Spinner } from "@/components/ui/spinner";
import PAGINATION from "@/constants/pagination";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { useTranslation } from "@/hooks/use-translation";
import { numberFormat } from "@/lib/format";
import { unicum } from "@/services/sdk";
import type { PlayerBattlesPayload } from "@/components/players/detail/overview/battles";
import { PlayerBattlesOffer } from "@/components/players/detail/overview/battles-offer";
import { PlayerBattlesProvenance } from "@/components/players/detail/overview/battles-provenance";
import { PlayerBattlesTable } from "@/components/players/detail/overview/battles-table";
import type { PlayerBattleEncounters } from "@unicum.gg/core/battles/met";
import { BattleEncounters } from "./encounters";
import { BattleFilters } from "./filters";
import { useBattleFilter } from "./use-battle-filter";

/** The row counts a page can hold. The endpoint serves a hundred at most, and
 * a row is a block rather than a line, so the feed's density is the default. */
const BATTLE_PAGE_SIZES = [PAGINATION.SIZE.FEED, 50, 100] as const;

/**
 * Every battle we hold for this player, a page at a time.
 *
 * The overview shows the last ten and stops, which left a player with three
 * hundred battles shared no way to reach the other two hundred and ninety. This
 * is that way. Paged by the endpoint rather than sliced here, unlike every
 * other table on the site: see `useServerPagination` for why.
 */
export function BattlesTab({
  region,
  nickname,
  metric,
  battleCount,
  initialBattles,
  initialEncounters,
}: {
  region: Region;
  nickname: string;
  metric: RatingMetric;
  /** From the profile payload, so the pager has its last page before the
   * first page has arrived. The answer's own total takes over once it has. */
  battleCount: number;
  /** The first page, server-rendered when the visitor landed on this tab. */
  initialBattles: PlayerBattlesPayload | null;
  /** Who the player meets in their battles, server-rendered with that page. */
  initialEncounters: PlayerBattleEncounters | null;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const { locale } = useLocale();

  // The pager needs a total to place itself and the total comes with the page,
  // so it starts from the profile's count and follows the answers from there.
  const [knownTotal, setKnownTotal] = useState(battleCount);
  const { page, pageSize, pager } = useServerPagination(
    knownTotal,
    PAGINATION.SIZE.FEED,
    { sizes: BATTLE_PAGE_SIZES },
  );
  const { filter, set, clear } = useBattleFilter();
  const filtered =
    filter.mode !== undefined ||
    filter.tank !== undefined ||
    filter.map !== undefined ||
    filter.result !== undefined;
  const request = () =>
    unicum
      .region(region)
      .players(nickname)
      .battles({
        language: locale,
        limit: pageSize,
        page,
        facets: "true",
        ...filter,
      });
  const firstPage =
    page === 1 && pageSize === PAGINATION.SIZE.FEED && !filtered;
  const { data, isLoading } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as PlayerBattlesPayload),
    {
      fallbackData: firstPage ? (initialBattles ?? undefined) : undefined,
      // The seed can be a day old, like the overview's.
      revalidateOnMount: true,
      revalidateOnFocus: false,
      // The page being left stays on screen until the next one arrives, rather
      // than the list collapsing to a spinner and the pager jumping up the page.
      keepPreviousData: true,
    },
  );
  if (data && data.total !== knownTotal) setKnownTotal(data.total);
  const total = data?.total ?? knownTotal;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {total > 0
              ? t("title-count", {
                  nickname,
                  count: numberFormat(locale).format(total),
                })
              : t("title", { nickname })}
          </PanelTitle>
        </PanelHeader>
        {!data && isLoading ? (
          <PanelContent className="flex justify-center py-8">
            <Spinner />
          </PanelContent>
        ) : !data || (data.battles.length === 0 && !filtered) ? (
          <PlayerBattlesOffer region={region} nickname={nickname} metric={metric} />
        ) : (
          <>
            <PlayerBattlesProvenance />
            {data.facets ? (
              <PanelContent className="border-fd-border border-t">
                <BattleFilters
                  facets={data.facets}
                  filter={filter}
                  onChange={set}
                  onClear={clear}
                />
              </PanelContent>
            ) : null}
            {data.battles.length === 0 ? (
              <PanelContent>
                <p className="text-fd-muted-foreground py-6 text-center text-sm">
                  {t("filter.empty")}
                </p>
              </PanelContent>
            ) : null}
            <PanelContent className="p-0">
              <PlayerBattlesTable
                region={region}
                nickname={nickname}
                metric={metric}
                accountId={data.accountId}
                battles={data.battles}
              />
              <TablePager pager={pager} />
            </PanelContent>
          </>
        )}
      </Panel>
      {total > 0 ? (
        <BattleEncounters
          region={region}
          nickname={nickname}
          filter={filter}
          initial={filtered ? null : initialEncounters}
        />
      ) : null}
    </>
  );
}
