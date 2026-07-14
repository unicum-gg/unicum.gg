/**
 * Which side of the search pipeline a streamed result chunk came from. `Local`
 * is served from our Postgres mirror (instant); `Remote` streams in after from
 * the rate-limited WG API, deduped against the local hits. The string values
 * are the on-the-wire NDJSON `source` field.
 */
export enum SearchSource {
  Local = "local",
  Remote = "remote",
}
