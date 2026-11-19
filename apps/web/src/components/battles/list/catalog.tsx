"use client";

import useSWR from "swr";
import { useState, useSyncExternalStore } from "react";
import { useLocale } from "@onruntime/translations/react";
import {
  BattleCatalogSort,
  DEFAULT_BATTLE_CATALOG_SORT,
  LATEST_BATTLE_VERSION,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { SegmentedControl } from "@/components/segmented-control";
import { TablePager } from "@/components/table-pager";
import { Spinner } from "@/components/ui/spinner";
import PAGINATION from "@/constants/pagination";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { useTranslation } from "@/hooks/use-translation";
import { numberFormat } from "@/lib/format";
import { sharedParamStore } from "@/lib/url-param-store";
import { unicum } from "@/services/sdk";
import { PlayerBattlesTable } from "@/components/players/detail/overview/battles-table";
import {
  BattleFilters,
  SELECT_FRAME,
  SELECT_TRIGGER,
  type BattleFacets,
} from "@/components/players/detail/battles/filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL, useCatalogFilter, VERSION_PARAM } from "./use-catalog-filter";
import { topBattleRows } from "@/components/tanks/detail/loadouts/build-views";
import ROUTES from "@/constants/routes";
import { BattleParam, BattleTab } from "@/components/players/detail/overview/battle-types";

/** The catalogue as the endpoint answers it. */
export type BattlesCatalogPayload = {
  battles: (Parameters<typeof topBattleRows>[0]["topBattles"][number] & {
    /** How often the recording was opened and downloaded. */
    stats?: { views: number; downloads: number };
  })[];
  total: number;
  facets?: BattleFacets;
  /** The update the list is narrowed to, `latest` resolved. */
  version: string | null;
  /** The updates the catalogue holds, newest first. */
  versions?: { value: string; count: number }[];
};

/** The orders offered, the default first. */
const SORTS = [
  BattleCatalogSort.Damage,
  BattleCatalogSort.Assist,
  BattleCatalogSort.Xp,
  BattleCatalogSort.Kills,
  BattleCatalogSort.Views,
  BattleCatalogSort.Downloads,
  BattleCatalogSort.Recent,
];

/** The query param the order rides in, so a ranked list is a link. */
const SORT_PARAM = "sort";

/** The row counts a page can hold, as on a player's Battles tab. */
const PAGE_SIZES = [PAGINATION.SIZE.FEED, 50, 100] as const;

const nullSnapshot = () => null;

/**
 * Every battle whose replay was archived, a page at a time, drawn as a
 * player's own Battles tab draws them: the same filters, the same cards, each
 * leading with the player who reported it and opening on its full report and
 * its 2D replay.
 *
 * The first page in the default order is server-rendered with the page; any
 * other order, filter or page is asked for here, and all of it rides in the URL
 * so a ranked, filtered list is something to send to somebody.
 */
export function BattlesCatalog({
  region,
  initial,
}: {
  region: Region;
  initial: BattlesCatalogPayload | null;
}) {
  const { t } = useTranslation("components/battles/list/catalog");
  const { locale } = useLocale();
  // A battle has no PR or WTR, so a reader on either reads the WN fallback.
  const { wnMetric: metric } = useRatingMetric();

  const sortStore = sharedParamStore(SORT_PARAM);
  const pageStore = sharedParamStore(PAGINATION.PARAM);
  const rawSort = useSyncExternalStore(sortStore.subscribe, sortStore.read, nullSnapshot);
  const sort = Object.values(BattleCatalogSort).includes(rawSort as BattleCatalogSort)
    ? (rawSort as BattleCatalogSort)
    : DEFAULT_BATTLE_CATALOG_SORT;

  const [knownTotal, setKnownTotal] = useState(initial?.total ?? 0);
  const { page, pageSize, pager } = useServerPagination(
    knownTotal,
    PAGINATION.SIZE.FEED,
    { sizes: PAGE_SIZES },
  );
  const { filter, changed, set, clear } = useCatalogFilter();
  const request = () =>
    unicum.region(region).battles.list({
      language: locale,
      limit: pageSize,
      page,
      facets: "true",
      ...(sort === DEFAULT_BATTLE_CATALOG_SORT ? {} : { sort }),
      ...filter,
    });
  // The server renders the page as it opens: random battles of the newest
  // update, by damage. Anything else is asked for here.
  const firstPage =
    page === 1 &&
    pageSize === PAGINATION.SIZE.FEED &&
    !changed &&
    sort === DEFAULT_BATTLE_CATALOG_SORT;
  const { data, isLoading } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as BattlesCatalogPayload),
    {
      fallbackData: firstPage ? (initial ?? undefined) : undefined,
      revalidateOnMount: true,
      revalidateOnFocus: false,
      // The page being left stays on screen until the next one arrives.
      keepPreviousData: true,
    },
  );
  if (data && data.total !== knownTotal) setKnownTotal(data.total);
  const total = data?.total ?? knownTotal;
  const facets = data?.facets ?? initial?.facets;
  const versions = data?.versions ?? initial?.versions ?? [];
  const newest = versions[0]?.value;
  // The select names a real update even when the URL says `latest`.
  const pickedVersion =
    filter.version === LATEST_BATTLE_VERSION
      ? (data?.version ?? newest ?? ALL)
      : (filter.version ?? ALL);
  const rows = data
    ? topBattleRows({ topBattles: data.battles }).map((row, index) => ({
        ...row,
        replayStats: data.battles[index]?.stats,
      }))
    : [];

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>
          {t("title", { count: numberFormat(locale).format(total) })}
        </PanelTitle>
        <SegmentedControl
          active={sort}
          onSelect={(next) => {
            sortStore.write(next === DEFAULT_BATTLE_CATALOG_SORT ? null : next);
            pageStore.write(null);
          }}
          segments={SORTS.map((id) => ({
            id,
            label: t(`sort.${id}`),
          }))}
        />
      </PanelHeader>
      {facets ? (
        <PanelContent className="border-fd-border border-t">
          <BattleFilters
            facets={facets}
            filter={filter}
            onChange={set}
            onClear={clear}
            clearable={changed}
          >
            {versions.length > 0 ? (
              <div className={SELECT_FRAME}>
                <Select
                  value={pickedVersion}
                  onValueChange={(v) =>
                    set(
                      VERSION_PARAM,
                      v === ALL ? null : v === newest ? LATEST_BATTLE_VERSION : v,
                    )
                  }
                >
                  <SelectTrigger size="sm" className={SELECT_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* No count: the catalogue counts every mode, and a number
                        beside a list narrowed to one would not be its size. */}
                    {versions.map(({ value }) => (
                      <SelectItem key={value} value={value}>
                        {t(value === newest ? "version-current" : "version", {
                          version: value,
                        })}
                      </SelectItem>
                    ))}
                    <SelectItem value={ALL}>{t("version-all")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </BattleFilters>
        </PanelContent>
      ) : null}
      {!data && isLoading ? (
        <PanelContent className="flex justify-center py-8">
          <Spinner />
        </PanelContent>
      ) : rows.length === 0 ? (
        <PanelContent>
          <p className="text-fd-muted-foreground py-6 text-center text-sm">
            {changed ? t("empty-filtered") : t("empty")}
          </p>
        </PanelContent>
      ) : (
        <PanelContent className="p-0">
          <PlayerBattlesTable
            region={region}
            metric={metric}
            battles={rows}
            withVehicle
            // Each row opens its recorder's side of the battle, on the replay,
            // which is what a reader browsing replays came for and gives a
            // crawler a link to every one.
            battleHref={(battle) =>
              battle.player
                ? ROUTES.BATTLE_PLAYER(region, battle.id, battle.player.accountId)
                : `${ROUTES.BATTLE(region, battle.id)}?${BattleParam.Tab}=${BattleTab.Replay}`
            }
          />
          <TablePager pager={pager} />
        </PanelContent>
      )}
    </Panel>
  );
}
