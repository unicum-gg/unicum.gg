"use client";

import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  ManeuversBoardKind,
  maneuversCutoffForecast,
  maneuversBonds,
  maneuversMultiplier,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { TaggedTitle } from "@/components/clans/detail/tagged-title";
import { PlayerName } from "@/components/entity/player-name";
import { maneuversEditionName } from "@/components/maneuvers/edition-name";
import { GainCell } from "@/components/maneuvers/columns";
import { FamePoints, FamePointsCell } from "@/components/maneuvers/fame-points";
import { ManeuversClanRewards } from "@/components/maneuvers/rewards-in-play";
import {
  ManeuversPastEdition,
  ManeuversStanding,
} from "@/components/maneuvers/standing";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";

// recharts arrives only once there is a climb worth drawing.
const ManeuversClimbChart = dynamic(
  () => import("@/components/maneuvers/climb-chart").then((m) => m.ManeuversClimbChart),
  { ssr: false, loading: () => <div className="h-64 w-full" /> },
);

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const MEMBERS_PAGE_SIZE = 25;

export type ClanManeuversData = Awaited<
  ReturnType<ReturnType<ReturnType<typeof unicum.region>["clans"]>["maneuvers"]>
>;
type Member = ClanManeuversData["members"][number];

function boardHref(region: Region, eventName: string, isLatest: boolean) {
  const base = ROUTES.CLANS_MANEUVERS(region);
  return isLatest ? base : `${base}?edition=${encodeURIComponent(eventName)}`;
}

/**
 * The clan's Maneuvers record: its place on the edition being played and how
 * it climbed against the gold line, every edition it placed in before, and
 * which of its players sit on the player board. That last table is the one an
 * officer steers by, and the game shows it nowhere: its clan board and its
 * player board are two screens that never meet.
 */
export function ClanManeuversTab({
  region,
  tag,
  color,
  data,
}: {
  region: Region;
  tag: string;
  color: string;
  data: ClanManeuversData | null;
}) {
  const { t } = useTranslation("components/clans/detail/overview/maneuvers");
  const { t: tEdition } = useTranslation("components/maneuvers/edition-name");
  const { t: tGame } = useTranslation("game/vocabulary");
  const maneuvers = tGame("battle-formats.maneuvers");
  const zone = useDisplayZone();
  const current = data?.current ?? null;
  const latest = data?.latest ?? null;
  const climb = data?.history ?? [];

  // The edition's own gold line, so the climb is drawn against its price.
  const { data: race } = useSWR(
    current ? ["maneuvers-history", region, current.eventName] : null,
    () => unicum.region(region).maneuversHistory(current!.eventName),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const cutoffs = (race?.points ?? []).map((p) => ({
    t: p.t,
    cutoff: p.clanGoldCutoffPoints,
  }));
  // Where the line ends, once enough evenings have been watched to say.
  const projected = current
    ? (maneuversCutoffForecast(
        cutoffs,
        current.startDate ? Date.parse(current.startDate) / 1000 : null,
        current.endDate ? Date.parse(current.endDate) / 1000 : null,
      ).projection?.points ?? null)
    : null;
  const past = (data?.editions ?? []).filter((e) => e.eventName !== current?.eventName);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              {t("title", { maneuvers })}
            </TaggedTitle>
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {!data ? (
            <div className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
              {t("loading")}
            </div>
          ) : current ? (
            <ManeuversStanding
              kind={ManeuversBoardKind.Clans}
              standing={current}
              href={boardHref(region, current.eventName, true)}
              edition={maneuversEditionName(current.eventName, tEdition)}
              cutoffPoints={cutoffs.at(-1)?.cutoff ?? null}
            projectedCutoff={projected}
            />
          ) : null}
          {data && current ? (
            <ManeuversClanRewards
              current={current}
              clanBondsPercent={data.clanBondsPercent}
            />
          ) : data ? (
            <div className="px-4 py-8 text-sm text-fd-muted-foreground">
              {latest
                ? t("no-place", {
                    edition: maneuversEditionName(latest.eventName, tEdition),
                  })
                : t("no-edition")}
            </div>
          ) : null}
          {current && climb.length >= 2 ? (
            <ManeuversClimbChart
              climb={climb}
              cutoffs={cutoffs}
              cutoffLabel={t("gold-line")}
              zone={zone}
            />
          ) : null}
          {past.length > 0 ? (
            <ul className="divide-y divide-fd-border border-t border-fd-border">
              {past.map((e) => (
                <ManeuversPastEdition
                  key={e.eventName}
                  kind={ManeuversBoardKind.Clans}
                  standing={e}
                  href={boardHref(region, e.eventName, false)}
                  edition={maneuversEditionName(e.eventName, tEdition)}
                />
              ))}
            </ul>
          ) : null}
        </PanelContent>
      </Panel>
      {data && data.members.length > 0 ? (
        <ClanManeuversMembers
          region={region}
          members={data.members}
          ranked={data.playersRanked ?? 0}
          vehiclePositions={data.vehiclePositions}
          accountBondsPercent={data.accountBondsPercent}
          multiplier={
            current
              ? maneuversMultiplier(current.place, current.ranked ?? 0, data.clanBondsPercent)
              : 1
          }
        />
      ) : null}
    </>
  );
}

/** The clan's players on the player board, as the board ranks them. */
function ClanManeuversMembers({
  region,
  members,
  ranked,
  vehiclePositions,
  accountBondsPercent,
  multiplier,
}: {
  region: Region;
  members: Member[];
  ranked: number;
  vehiclePositions: number | null;
  accountBondsPercent: number | null;
  /** The clan's multiplier on every member's bonds. */
  multiplier: number;
}) {
  const { t } = useTranslation("components/clans/detail/overview/maneuvers");
  const { t: tCols } = useTranslation("components/maneuvers/columns");
  const { num } = useFormat();
  const fmt = num(INT_FORMAT);
  // `members` is the SWR answer as it arrived, so its identity only moves when
  // the data does, which is what the pager resets on.
  const { paged, pager } = usePagination(members, MEMBERS_PAGE_SIZE, { param: "members" });
  const winning =
    vehiclePositions == null ? null : members.filter((m) => m.place <= vehiclePositions).length;
  const measured = members.some((m) => m.gain24h != null);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>{t("members", { count: fmt.format(members.length) })}</PanelTitle>
          {winning != null ? (
            <span className="text-xs text-fd-muted-foreground">
              {t("members-winning", { count: fmt.format(winning) })}
            </span>
          ) : null}
        </PanelHeader>
        <PanelContent className="p-0">
          <Table
            className={cn(
              "my-0! table-fixed",
              "[&_td]:min-w-0 [&_td]:py-2!",
              "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
              "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
            )}
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 text-center!">{t("place")}</TableHead>
                <TableHead>{t("player")}</TableHead>
                <TableHead className="w-40 text-right!">{t("fame-points")}</TableHead>
                {measured ? (
                  <TableHead className="w-24 text-right!" title={tCols("gain-hint")}>
                    {tCols("gain")}
                  </TableHead>
                ) : null}
                <TableHead className="w-28 text-right!" title={t("bonds-hint")}>
                  {t("bonds")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((m) => (
                <TableRow
                  key={m.accountId}
                  className={cn(
                    vehiclePositions != null &&
                      m.place > vehiclePositions &&
                      "text-muted-foreground",
                  )}
                >
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {fmt.format(m.place)}
                  </TableCell>
                  <TableCell>
                    <PlayerName
                      region={region}
                      href={
                        m.nickname ? ROUTES.PLAYER_MANEUVERS(region, m.nickname) : undefined
                      }
                      player={{
                        nickname: m.nickname ?? String(m.accountId),
                        accountId: m.accountId,
                        isVerified: m.isVerified,
                        isSupporter: m.isSupporter,
                        twitchLogin: m.twitchLogin,
                        tournamentWins: m.tournamentWins,
                        tournamentFeaturedWins: m.tournamentFeaturedWins,
                        tournamentBestTitle: m.tournamentBestTitle,
                        onslaughtBestTier: m.onslaughtBestTier,
                        onslaughtBestRank: m.onslaughtBestRank,
                        onslaughtSeasons: m.onslaughtSeasons,
                      }}
                    />
                  </TableCell>
                  <FamePointsCell place={m.place} ranked={ranked}>
                    <FamePoints value={m.famePoints} />
                  </FamePointsCell>
                  {measured ? <GainCell value={m.gain24h} /> : null}
                  <TableCell className="text-right tabular-nums">
                    {(() => {
                      const bonds = maneuversBonds(m.place, ranked, accountBondsPercent);
                      return bonds > 0 ? fmt.format(Math.round(bonds * multiplier)) : "—";
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pager.total > MEMBERS_PAGE_SIZE ? <TablePager pager={pager} /> : null}
        </PanelContent>
      </Panel>
    </>
  );
}
