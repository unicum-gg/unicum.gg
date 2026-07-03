// Pure clan-event value/type definitions, free of the portal fetch layer in
// `events.ts` (which pulls `fetch.ts` -> `perf-trace` -> node:async_hooks).
// Kept separate so client components can import `ClanEventType` into the
// browser bundle without dragging server-only modules along.
export enum ClanEventType {
  JoinClan = "join_clan",
  LeaveClan = "leave_clan",
  ChangeRole = "change_role",
}

export type ClanRecentEvent = {
  type: ClanEventType;
  createdAt: Date;
  accountId: number;
  accountName: string;
  oldRole: string | null;
  newRole: string | null;
  oldRank: number | null;
  newRank: number | null;
};
