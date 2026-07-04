import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

/** Game ID for `/wgn/servers/info/` (`game`). */
export enum WgnGame {
  WorldOfTanksBlitz = "wotb",
  WorldOfTanks = "wot",
  WorldOfWarships = "wows",
}

/** `/wgn/servers/info/` — one server cluster's online count. */
export type ServerInfo = {
  players_online: number;
  server: string;
};

/** `/wgn/servers/info/` — players online per server cluster (WGN, cross-game). */
export class ServersResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** Online counts, keyed by game (e.g. `wot`). */
  async info<const F extends readonly FieldPath<ServerInfo>[] = readonly never[]>(params: {
    game?: readonly WgnGame[];
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<ServerInfo, F>[]>> {
    const query = buildQuery(params);
    if (params.game?.length) query.game = params.game.join(",");
    return this.t.wgFetch<Record<string, Selected<ServerInfo, F>[]>>(
      this.region,
      "/wgn/servers/info/",
      query,
    );
  }
}
