/** Live server population (client-safe types). The fetch lives in core
 * (`wargaming/wot/server/online`). */
export type ServerOnline = { server: string; players_online: number };
export type OnlinePayload = { total: number; servers: ServerOnline[] } | null;
