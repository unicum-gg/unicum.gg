"use client";

import type { ReactNode } from "react";
import {
  PANEL_ROW_CLASS,
  PANEL_ROW_VALUE_CELL_CLASS,
} from "@/components/entity/panel-row";
import { PlayerName } from "@/components/entity/player-name";
import type { PlayerIdentity } from "@/components/entity/player-identity";
import { RelativeTime } from "@/components/relative-time";
import type { Region } from "@unicum.gg/wargaming";

/** How many columns the list is dealt into at full width. */
const COLUMNS = 3;

/**
 * Dealt into balanced columns rather than filling each in turn, like the marks
 * panel's reach list: four rows across three columns read as two, one and one
 * otherwise. Empty columns are dropped, so a short list never draws a blank
 * card beside a populated one.
 */
function columnsOf<T>(rows: T[], count: number): T[][] {
  const per = Math.ceil(rows.length / count);
  return Array.from({ length: count }, (_, i) =>
    rows.slice(i * per, (i + 1) * per),
  ).filter((column) => column.length > 0);
}

/** One entry: who, when they were last seen, and the figure that qualifies them. */
export type PlayerPanelEntry = {
  key: string | number;
  player: PlayerIdentity;
  /** Shown under the name as "Last <ago>". Omit to leave the line out. */
  lastAt?: Date;
  /** The figure the row leads with, and the line under it saying what it is. */
  value: ReactNode;
  caption: ReactNode;
};

/**
 * A panel listing PLAYERS: the profile's teammates, the clan's line-up, and
 * whatever comes next.
 *
 * The two that existed were byte-identical apart from their value cell, down to
 * the column balancing and the card chrome, which is the drift `PANEL_ROW_CLASS`
 * was extracted to stop one screen earlier. The caller supplies the rows and
 * what each one leads with; everything about the shape lives here.
 *
 * One column or three, never two: the rows are dealt into a fixed number of
 * cards, so a grid that dropped to two at some width would leave the third card
 * wrapping under the first and one column reading twice as long as its
 * neighbour.
 */
export function PlayerPanelList({
  region,
  entries,
}: {
  region: Region;
  entries: PlayerPanelEntry[];
}) {
  return (
    <div className="grid gap-px border-t border-fd-border bg-fd-border lg:grid-cols-3">
      {columnsOf(entries, COLUMNS).map((column, i) => (
        <div key={i} className="bg-fd-card">
          <ul>
            {column.map((entry) => (
              <li key={entry.key} className={PANEL_ROW_CLASS}>
                <div className="min-w-0 flex-1">
                  <PlayerName
                    region={region}
                    player={entry.player}
                    className="text-sm"
                  />
                  {entry.lastAt && (
                    <div className="text-xs text-fd-muted-foreground">
                      Last <RelativeTime date={entry.lastAt} />
                    </div>
                  )}
                </div>
                <div className={PANEL_ROW_VALUE_CELL_CLASS}>
                  <span className="text-sm font-semibold">{entry.value}</span>
                  <span className="text-xs text-fd-muted-foreground">
                    {entry.caption}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
