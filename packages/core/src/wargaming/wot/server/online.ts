import { type Region, WgnGame } from "@unicum.gg/wargaming";
import type { OnlinePayload } from "@unicum.gg/shared";
import { wg } from "../../client";

// Client-safe shapes live in `@unicum.gg/shared`; re-exported for back-compat.
export type { ServerOnline, OnlinePayload } from "@unicum.gg/shared";

/**
 * How many players are on each of the region's clusters right now.
 *
 * The cluster keeps the name Wargaming gives it ("EU1", "203", "501"), which is
 * also the name the game's own server selector shows: the client reads it from
 * the login response rather than from its own files, and it is what the WGN
 * endpoint echoes back. This used to relabel them `EU1..EUn` by descending
 * population, which read tidily but meant the label named a rank rather than a
 * server, so "EU1" moved from one cluster to another whenever two of them
 * traded places. Harmless for a tooltip, fatal for the recorded history, where
 * a series keyed on the label would splice different servers together.
 *
 * Sorted busiest-first for display. A failed call returns null rather than an
 * empty region: the caller keeps its last known figure, and the sampler writes
 * nothing, since a hole recorded as zeros would read as a dead server ever
 * after.
 */
export const fetchPlayersOnline = async (region: Region): Promise<OnlinePayload> => {
  try {
    const data = await wg.region(region).api.wgn.servers.info({ game: [WgnGame.WorldOfTanks] });
    const servers = [...(data.wot ?? [])].sort(
      (a, b) => b.players_online - a.players_online,
    );
    const total = servers.reduce((sum, s) => sum + s.players_online, 0);
    return { total, servers };
  } catch {
    return null;
  }
};
