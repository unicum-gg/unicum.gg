"use client";

import dynamic from "next/dynamic";
import useSWR from "swr";
import { maneuversCutoffForecast, ManeuversBoardKind } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { maneuversEditionName } from "@/components/maneuvers/edition-name";
import { ManeuversPlayerRewards } from "@/components/maneuvers/rewards-in-play";
import {
  ManeuversPastEdition,
  ManeuversStanding,
} from "@/components/maneuvers/standing";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";

// recharts arrives only once there is a climb worth drawing.
const ManeuversClimbChart = dynamic(
  () => import("@/components/maneuvers/climb-chart").then((m) => m.ManeuversClimbChart),
  { ssr: false, loading: () => <div className="h-64 w-full" /> },
);

export type PlayerManeuversData = Awaited<
  ReturnType<ReturnType<ReturnType<typeof unicum.region>["players"]>["maneuvers"]>
>;

/** The board this standing is a place on, at the right edition. The newest is
 * the board's default, so it needs no query of its own. */
function boardHref(region: Region, eventName: string, isLatest: boolean) {
  const base = ROUTES.PLAYERS_MANEUVERS(region);
  return isLatest ? base : `${base}?edition=${encodeURIComponent(eventName)}`;
}

/**
 * The player's Maneuvers record: where they stand on the edition being played,
 * how they climbed to it against the vehicle line, and every edition they
 * placed in before.
 *
 * Like Onslaught, a standing on a board we capture rather than statistics
 * Wargaming publishes per account, so every standing links back to the board
 * it is a place on.
 */
export function ManeuversTab({
  region,
  data,
  loading,
  nickname,
}: {
  region: Region;
  data: PlayerManeuversData | null;
  loading: boolean;
  nickname: string;
}) {
  const { t } = useTranslation("components/players/detail/maneuvers/index");
  const { t: tEdition } = useTranslation("components/maneuvers/edition-name");
  const { t: tGame } = useTranslation("game/vocabulary");
  // The event's own name, as the reader's client writes it.
  const maneuvers = tGame("battle-formats.maneuvers");
  const zone = useDisplayZone();
  const current = data?.current ?? null;
  const latest = data?.latest ?? null;
  const climb = data?.history ?? [];

  // The edition's own vehicle line, so the climb is drawn against the price of
  // the place it is after. Only asked for once there is a climb to draw.
  const { data: race } = useSWR(
    current ? ["maneuvers-history", region, current.eventName] : null,
    () => unicum.region(region).maneuversHistory(current!.eventName),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const cutoffs = (race?.points ?? []).map((p) => ({
    t: p.t,
    cutoff: p.tankCutoffPoints,
  }));
  // Where the line ends, once enough evenings have been watched to say.
  const projected = current
    ? (maneuversCutoffForecast(
        cutoffs,
        current.startDate ? Date.parse(current.startDate) / 1000 : null,
        current.endDate ? Date.parse(current.endDate) / 1000 : null,
      ).projection?.points ?? null)
    : null;
  const cutoffNow = cutoffs.at(-1)?.cutoff ?? null;

  if (loading && !data) {
    return (
      <Shell>
        <PanelContent className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
          {t("loading", { nickname, maneuvers })}
        </PanelContent>
      </Shell>
    );
  }

  const past = (data?.editions ?? []).filter(
    (e) => e.eventName !== current?.eventName,
  );

  return (
    <Shell title={t("title", { nickname, maneuvers })}>
      <PanelContent className="p-0">
        {current ? (
          <ManeuversStanding
            kind={ManeuversBoardKind.Players}
            standing={current}
            href={boardHref(region, current.eventName, true)}
            edition={maneuversEditionName(current.eventName, tEdition)}
            cutoffPoints={cutoffNow}
            projectedCutoff={projected}
          />
        ) : null}
        {current ? (
          <ManeuversPlayerRewards current={current} />
        ) : (
          <div className="px-4 py-8 text-sm text-fd-muted-foreground">
            <p>
              {latest
                ? t("no-place", {
                    nickname,
                    edition: maneuversEditionName(latest.eventName, tEdition),
                  })
                : t("no-edition")}
            </p>
            <p className="mt-2">{t("how-to-enter")}</p>
          </div>
        )}
        {current && climb.length >= 2 ? (
          <ManeuversClimbChart
            climb={climb}
            cutoffs={cutoffs}
            cutoffLabel={t("vehicle-line")}
            zone={zone}
          />
        ) : null}
        {past.length > 0 ? (
          <ul className="divide-y divide-fd-border border-t border-fd-border">
            {past.map((e) => (
              <ManeuversPastEdition
                key={e.eventName}
                kind={ManeuversBoardKind.Players}
                standing={e}
                href={boardHref(region, e.eventName, false)}
                edition={maneuversEditionName(e.eventName, tEdition)}
              />
            ))}
          </ul>
        ) : null}
      </PanelContent>
    </Shell>
  );
}

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        {title ? (
          <PanelHeader>
            <PanelTitle>{title}</PanelTitle>
          </PanelHeader>
        ) : null}
        {children}
      </Panel>
    </>
  );
}
