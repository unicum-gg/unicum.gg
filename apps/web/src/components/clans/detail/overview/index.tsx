"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TaggedTitle } from "@/components/clans/detail/tagged-title";
import { ClanMembersTable } from "@/components/clans/detail/overview/members-table";
import { PreviousClansTable } from "@/components/clans/detail/overview/previous-clans-table";
import { ClanRecentActivity } from "@/components/clans/detail/overview/recent-activity";
import type { ClanMemberStats } from "@unicum.gg/shared";
import type { ClanRecentEvent, Region } from "@unicum.gg/wargaming";
import type { PreviousClanRow } from "@/services/clans/previous-clans";

/** The Overview section under the default Random Battles mode: the members
 * table (random-battles ratings), plus members' previous clans and recent
 * join/leave activity when present. */
export function RandomBattlesTab({
  region,
  tag,
  color,
  members,
  previousClans,
  events,
}: {
  region: Region;
  tag: string;
  color: string;
  members: ClanMemberStats[];
  previousClans: PreviousClanRow[];
  events: ClanRecentEvent[];
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              members random battles stats
            </TaggedTitle>
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <ClanMembersTable region={region} members={members} />
        </PanelContent>
      </Panel>

      {previousClans.length > 0 && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                <TaggedTitle tag={tag} color={color}>
                  members previous clans
                </TaggedTitle>
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <PreviousClansTable region={region} rows={previousClans} />
            </PanelContent>
          </Panel>
        </>
      )}

      {events.length > 0 && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                <TaggedTitle tag={tag} color={color}>
                  recent activity
                </TaggedTitle>
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <ClanRecentActivity region={region} events={events} />
            </PanelContent>
          </Panel>
        </>
      )}
    </>
  );
}
