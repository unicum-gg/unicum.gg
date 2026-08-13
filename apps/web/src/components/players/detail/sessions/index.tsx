"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TableSkeleton } from "@/components/table-skeleton";
import { SESSIONS_SKELETON_COLUMNS } from "./skeleton-columns";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  SessionGranularity,
  type PlayerSession,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { PlayerSessionsTable } from "./table";

const GRANULARITIES: { id: SessionGranularity; label: string }[] = [
  { id: SessionGranularity.Daily, label: "Daily" },
  { id: SessionGranularity.Weekly, label: "Weekly" },
  { id: SessionGranularity.Monthly, label: "Monthly" },
];

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function labelFor(period: string, granularity: SessionGranularity): string {
  const d = new Date(`${period}T00:00:00Z`);
  if (granularity === SessionGranularity.Monthly) return monthFmt.format(d);
  if (granularity === SessionGranularity.Weekly) {
    return `Week of ${shortFmt.format(d)}`;
  }
  return dayFmt.format(d);
}

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
              recomputed from its own totals, never averaged from its days. */}
          <div className="flex items-center gap-1">
            {GRANULARITIES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onGranularity(g.id)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  g.id === granularity
                    ? "bg-fd-primary/10 text-fd-primary"
                    : "text-fd-muted-foreground hover:text-fd-foreground",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
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
            <PlayerSessionsTable
              region={region}
              sessions={sessions}
              metric={metric}
              dateLabel={(p) => labelFor(p, granularity)}
            />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
