import { getPreviousClans } from "@/services/clans/previous-clans";
import { getClanEventsCached } from "@unicum.gg/core/clans/repository/events";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import {
  getClanSnapshotPeriods,
  getLatestClanSnapshot,
} from "@unicum.gg/core/clans/snapshots";
import type { ClanSnapshot } from "@unicum.gg/core/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import type { ClanRecentEvent } from "@unicum.gg/core/wargaming/wot/clans/event-types";
import type { ClanMemberStats } from "@unicum.gg/core/clans/members";
import type { PreviousClanRow } from "./previous-clans";
import type { ClanSnapshotPeriods } from "@unicum.gg/core/clans/snapshot-stats";

// The clan detail resource: everything the clan page and the
// `GET /api/[region]/clans/[tag]` endpoint expose. Consumed client-side (via
// SWR) as an `import type`, so the loader below stays server-only.
export type ClanDetailData = {
  clan: ClanFullInfo;
  members: ClanMemberStats[];
  previousClans: PreviousClanRow[];
  events: ClanRecentEvent[];
  snapshotLatest: ClanSnapshot | null;
  snapshotPeriods: ClanSnapshotPeriods;
};

// Optional tracing hook so the clan page can time each read; defaults to a
// passthrough for callers that don't trace (the API route).
type Span = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
const noSpan: Span = (_name, fn) => fn();

/**
 * Loads the freshness-sensitive clan detail (members with cached ratings,
 * previous clans, recent activity, stronghold/global-map snapshots) for an
 * already-resolved clan. Shared by the clan page SSR and the clan detail
 * endpoint so both assemble the exact same payload.
 */
export async function loadClanDetail(
  region: Region,
  clan: ClanFullInfo,
  span: Span = noSpan,
): Promise<ClanDetailData> {
  const [
    membersCached,
    previousClans,
    eventsCached,
    snapshotLatest,
    snapshotPeriods,
  ] = await Promise.all([
    span("getClanMembersCached", () => getClanMembersCached(region, clan.id)),
    span("getPreviousClans", () => getPreviousClans(region, clan.id)),
    span("getClanEventsCached", () => getClanEventsCached(region, clan.id, 30)),
    span("getLatestClanSnapshot", () => getLatestClanSnapshot(region, clan.id)),
    span("getClanSnapshotPeriods", () =>
      getClanSnapshotPeriods(region, clan.id),
    ),
  ]);
  return {
    clan,
    members: membersCached.members,
    previousClans,
    events: eventsCached.events,
    snapshotLatest,
    snapshotPeriods,
  };
}
