"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { TableSkeleton } from "@/components/table-skeleton";
import { CLAN_TOURNAMENTS_SKELETON_COLUMNS } from "./columns";
import { ClanTournamentsTable } from "./table";
import type { ClanTournamentRecord } from "./row";

/**
 * What the clan has entered, and how far it got.
 *
 * The join behind this tab does not exist upstream: Wargaming's tournament
 * system knows teams and account ids, never clans, and a team is whatever name
 * its captain typed. A team is tied to the clan here by matching its roster
 * against clan membership ON THE DAY it was played, so a 2019 result stays with
 * whoever actually played it rather than following those players to wherever
 * they are now.
 */
export function ClanTournamentsTab({
  region,
  tag,
  data,
}: {
  region: Region;
  tag: string;
  /** Undefined while loading, null when the read failed. */
  data: ClanTournamentRecord | null | undefined;
}) {
  const entries = data?.entries ?? [];
  return (
    <>
      {/* The rule every other clan section opens with. Without it the panel
          butted straight against the tab bar. */}
      <PanelSeparator />
      <Panel>
      <PanelHeader
        screenLines={false}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
      >
        {/* No count while it loads: "Tournaments (0)" is a real answer for
            most clans, and showing it before the read lands states the one
            thing the tab exists to deny. */}
        <PanelTitle>
          Tournaments{data ? ` (${entries.length})` : ""}
        </PanelTitle>
        {data && data.wins > 0 && (
          <span className="text-xs text-fd-muted-foreground">
            {data.wins} won
          </span>
        )}
      </PanelHeader>
      <PanelContent className="p-0">
        {data === undefined ? (
          <TableSkeleton
            columns={CLAN_TOURNAMENTS_SKELETON_COLUMNS}
            rows={8}
          />
        ) : entries.length === 0 ? (
          // Never entering one is the norm for most clans, so this says so
          // rather than reading as a section that failed to load.
          <p className={cn(styles.mutedDescription, "p-4")}>
            [{tag}] has not entered a tournament we have mirrored. A team counts
            as this clan&apos;s once a quarter of its roster were members on the
            day it played.
          </p>
        ) : (
          <ClanTournamentsTable region={region} entries={entries} />
        )}
      </PanelContent>
      </Panel>
    </>
  );
}
