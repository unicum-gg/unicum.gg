// The battle-weighted rating aggregation + member types are client-safe and
// live in `@unicum.gg/shared/clans/ratings`; re-exported here for back-compat.
// This module keeps the WG facade re-exports (member fetchers) that pull the
// WG client, so it stays server-only.
export * from "@unicum.gg/shared/clans/ratings";
export {
  ClanRole,
  getClanMembersBatch,
  getClanMembersStats,
} from "@unicum.gg/core/wargaming/wot/clans/members";
export type {
  ClanMemberPeriodStats,
  PortalClanMember,
} from "@unicum.gg/core/wargaming/wot/clans/members";
