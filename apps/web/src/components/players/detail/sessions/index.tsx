"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { MountOnVisible } from "@/components/mount-on-visible";
import { SegmentedControl } from "@/components/segmented-control";
import { TableSkeleton } from "@/components/table-skeleton";
import { SESSIONS_SKELETON_COLUMNS } from "./skeleton-columns";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_METRIC_LABEL,
  SessionGranularity,
  type PlayerSession,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { GRANULARITY_NOUN, sessionLabel } from "./labels";
import { PlayerActivityChart } from "./activity-chart-lazy";
import { PlayerSessionsTable } from "./table";

const GRANULARITIES = [
  { id: SessionGranularity.Daily, label: "Daily" },
  { id: SessionGranularity.Weekly, label: "Weekly" },
  { id: SessionGranularity.Monthly, label: "Monthly" },
];

/**
 * What a player has been playing, session by session.
 *
 * The game keeps no session log, so a row is what we sampled: the battles
 * between two consecutive readings of the account, dated by the last one the
 * player actually fought. That makes a row honest about a stretch of play
 * without claiming to know which evening each battle fell on.
 */
export function SessionsTab({
  region,
  nickname,
  sessions,
  loading,
  granularity,
  onGranularity,
}: {
  region: Region;
  nickname: string;
  sessions: PlayerSession[];
  loading: boolean;
  granularity: SessionGranularity;
  onGranularity: (g: SessionGranularity) => void;
}) {
  const [storedMetric] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric = isRatingMetric(storedMetric)
    ? storedMetric
    : DEFAULT_RATING_METRIC;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader
          screenLines={false}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
        >
          <PanelTitle>
            {nickname}&apos;s sessions
            {loading ? "" : ` (${sessions.length})`}
          </PanelTitle>
          {/* Three ways to read the same battles, not three datasets: a week is
              recomputed from its own totals, never averaged from its days. The
              site's segmented switch, the same one the language boards use for
              Any/Strict. */}
          <SegmentedControl
            segments={GRANULARITIES}
            active={granularity}
            onSelect={onGranularity}
          />
        </PanelHeader>
        <PanelContent className="p-0">
          {loading ? (
            <TableSkeleton columns={SESSIONS_SKELETON_COLUMNS} rows={10} />
          ) : sessions.length === 0 ? (
            <p className={cn(styles.mutedDescription, "p-4")}>
              No session yet. They appear once this account has been sampled
              twice with battles in between, which happens on its own as it is
              played.
            </p>
          ) : (
            <>
              {/* The shape of the same rows the table lists: when they played
                  and how it went, before reading any single one of them.
                  Deferred until it scrolls near the viewport, like the
                  profile's rating chart. */}
              <div className="border-b border-fd-border">
                <div className="px-4 pt-3">
                  <MountOnVisible placeholder={<div className="h-48 w-full" />}>
                    <PlayerActivityChart
                      sessions={sessions}
                      granularity={granularity}
                      metric={metric}
                      metricLabel={RATING_METRIC_LABEL[metric]}
                    />
                  </MountOnVisible>
                </div>
                <p className="p-4 text-sm text-fd-muted-foreground">
                  Bar height is battles played, colour is that{" "}
                  {GRANULARITY_NOUN[granularity]}&apos;s{" "}
                  {RATING_METRIC_LABEL[metric]}, in the same bands the site uses
                  everywhere else.
                </p>
              </div>
              <PlayerSessionsTable
                region={region}
                sessions={sessions}
                metric={metric}
                dateLabel={(p) => sessionLabel(p, granularity)}
              />
            </>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
