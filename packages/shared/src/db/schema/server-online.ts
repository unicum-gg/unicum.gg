import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * One physical table per region (eu_server_online, na_server_online, ...): the
 * recorded population of every game cluster, one row per cluster per sample.
 *
 * Wargaming publishes population as an instant and nothing else. `wgn/servers/
 * info` answers "how many are playing right now", there is no history endpoint,
 * and no third party archives the series either. So every figure the servers
 * section shows beyond the current minute exists only because this table
 * recorded it, which also means the history begins the day the sampler first ran
 * and can never be backfilled. Losing this table loses the data for good.
 *
 * `server` is verbatim what Wargaming returns ("EU1", "203", "501"), and that is
 * load-bearing. The read path used to relabel the clusters `EU1..EUn` by
 * descending population, so "EU1" meant "whichever cluster is busiest at this
 * instant": a series keyed on it would splice different servers together every
 * time two of them traded places. The raw name is also the name the game itself
 * shows in its server selector, since the client takes it from the login
 * response rather than from its own files.
 */
export function makeServerOnlineTable(region: string) {
  return pgTable(
    `${region}_server_online`,
    {
      /** Wargaming's own cluster name, never a rank. */
      server: text("server").notNull(),
      /** Floored to the sampling period, so every cluster of a region shares one
       * timestamp and a region total is a plain GROUP BY rather than a join on
       * a time window. */
      sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
      playersOnline: integer("players_online").notNull(),
    },
    (t) => [
      // The pair, so a tick that runs twice for one period (two processes
      // racing the lease, a retry after a partial write) rewrites the same rows
      // instead of doubling that instant's population.
      primaryKey({ columns: [t.server, t.sampledAt] }),
      // Every read is a time window across all of the region's clusters (the
      // population series, the weekly rhythm, the peak), so the scan is by date
      // first and the primary key's server-major order does not serve it.
      index(`${region}_server_online_sampled_at_idx`).on(t.sampledAt),
    ],
  );
}

export type ServerOnlineTable = ReturnType<typeof makeServerOnlineTable>;
export type ServerOnlineRow = ServerOnlineTable["$inferSelect"];
export type NewServerOnlineRow = ServerOnlineTable["$inferInsert"];

export const serverOnlineByRegion: Record<Region, ServerOnlineTable> = {
  [Region.EU]: makeServerOnlineTable(Region.EU),
  [Region.NA]: makeServerOnlineTable(Region.NA),
  [Region.ASIA]: makeServerOnlineTable(Region.ASIA),
};
