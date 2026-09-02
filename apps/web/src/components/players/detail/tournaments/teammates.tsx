"use client";

import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import {
  PANEL_ROW_CLASS,
  PANEL_ROW_VALUE_CELL_CLASS,
} from "@/components/entity/panel-row";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RelativeTime } from "@/components/relative-time";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";
import type { PlayerTournamentTeammate } from "./row";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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

function TeammateRow({
  region,
  mate,
}: {
  region: Region;
  mate: PlayerTournamentTeammate;
}) {
  return (
    <li className={PANEL_ROW_CLASS}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          <Link
            href={ROUTES.PLAYER(region, mate.nickname)}
            className="hover:underline"
          >
            {mate.nickname}
          </Link>
          {mate.clanTag && (
            <>
              {" "}
              <ClanTag
                tag={mate.clanTag}
                color={mate.clanColor}
                className="font-mono text-xs"
              />
            </>
          )}
        </div>
        <div className="text-xs text-fd-muted-foreground">
          Last <RelativeTime date={mate.lastAt} />
        </div>
      </div>
      <div className={PANEL_ROW_VALUE_CELL_CLASS}>
        <span className="text-sm font-semibold">
          {intFmt.format(mate.together)}
        </span>
        <span className="text-xs text-fd-muted-foreground">
          together
        </span>
      </div>
    </li>
  );
}

/**
 * Who this player competes with.
 *
 * The question the tournament record raises and that nothing upstream can
 * answer: Wargaming's tournament system is addressable from the tournament's
 * side only, so "who does this player enter with" exists nowhere until every
 * roster is in one place and the account ids on them can be matched against
 * each other. It is the same join that puts a tournament on a player's page at
 * all, turned sideways.
 *
 * Ordered by how often, not how recently, because the panel answers "who are
 * this player's people" rather than "who did they last play with". Each row
 * carries its own date so the reader can make that distinction: a standing
 * partner and a stranger from one night in 2022 are the same distance apart
 * when the count is small.
 */
export function TournamentTeammates({
  region,
  nickname,
  teammates,
}: {
  region: Region;
  nickname: string;
  teammates: PlayerTournamentTeammate[];
}) {
  // Nothing to say for an account that has only ever entered solo formats, and
  // an empty panel reads as a section that failed rather than as an answer.
  if (teammates.length === 0) return null;
  const columns = columnsOf(teammates, COLUMNS);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s teammates</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-2">
            <p className="text-xs text-fd-muted-foreground">
              Everyone who has shared a tournament roster with {nickname}, most
              often first. Each row carries the last time they entered together.
            </p>
          </div>
          {/* One column or three, never two: the rows are dealt into a fixed
              number of cards, so a grid that drops to two at some width leaves
              the third card wrapping under the first and one column reading
              twice as long as its neighbour. Stacked below `lg`, the three
              cards simply follow each other and the list still reads in
              order. */}
          <div className="grid gap-px border-t border-fd-border bg-fd-border lg:grid-cols-3">
            {columns.map((column, i) => (
              <div key={i} className="bg-fd-card">
                <ul>
                  {column.map((mate) => (
                    <TeammateRow key={mate.accountId} region={region} mate={mate} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}
