/**
 * `@unicum.gg/sdk` — the fluent, typed client for the unicum.gg public API.
 *
 * The public surface is assembled from two sources, both re-exported wholesale:
 * - `runtime.ts`: hand-written infrastructure (the lazy `RequestHandle`, URL
 *   building, date revival, the SSE/NDJSON transports + subscription helpers,
 *   `UnicumError`, shared types).
 * - `generated/`: the fluent `Unicum` class and the OpenAPI schema types, both
 *   generated in full from the served spec (`pnpm --filter @unicum.gg/sdk
 *   generate`) — never edited by hand.
 */
export * from "./runtime";
export * from "./generated";
