"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TableSkeleton } from "@/components/table-skeleton";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { PlayerTournamentsTable } from "./table";
import { TOURNAMENTS_SKELETON_COLUMNS } from "./skeleton-columns";
import type { PlayerTournamentRecord } from "./row";
import { TournamentTeammates } from "./teammates";

/** One headline number, matching the summary strip the other tabs use. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-fd-muted-foreground uppercase">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/**
 * What a player has entered, and how far they got.
 *
 * Wargaming runs these constantly and publishes them from the tournament's side
 * only: their own pages list who is registered for one tournament, never what
 * one player has played. So this record is assembled from the other direction,
 * by matching the account id on every roster we have mirrored, and exists
 * nowhere else.
 */
export function TournamentsTab({
  region,
  nickname,
  data,
  loading,
}: {
  region: Region;
  nickname: string;
  data: PlayerTournamentRecord | null;
  loading: boolean;
}) {
  const entries = data?.entries ?? [];
  // A podium is a top-three finish in any of the tournament's brackets, so a
  // qualifier group counts. Placement is per bracket, not per tournament, which
  // is the only way the source expresses it.
  const podiums = entries.filter(
    (e) => e.bestPosition !== null && e.bestPosition <= 3,
  ).length;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader
          screenLines={false}
          className="flex flex-wrap items-center justify-between gap-4 border-b border-fd-border"
        >
          <PanelTitle>
            {nickname}&apos;s tournaments
            {loading ? "" : ` (${entries.length.toLocaleString("en-US")})`}
          </PanelTitle>
          {!loading && entries.length > 0 && (
            <div className="flex items-center gap-6">
              <Stat label="Entered" value={entries.length.toLocaleString("en-US")} />
              <Stat label="Won" value={String(data?.wins ?? 0)} />
              <Stat label="Podiums" value={String(podiums)} />
            </div>
          )}
        </PanelHeader>
        <PanelContent className="p-0">
          {loading ? (
            <TableSkeleton columns={TOURNAMENTS_SKELETON_COLUMNS} rows={10} />
          ) : entries.length === 0 ? (
            <p className={cn(styles.mutedDescription, "p-4")}>
              This account has never entered a Wargaming tournament. They run
              daily for gold at every tier, from 1v1 up to full clan
              championships, and take a team of as few as one.
            </p>
          ) : (
            <PlayerTournamentsTable region={region} entries={entries} />
          )}
        </PanelContent>
      </Panel>
      {!loading && (
        <TournamentTeammates
          region={region}
          nickname={nickname}
          teammates={data?.teammates ?? []}
        />
      )}
    </>
  );
}
