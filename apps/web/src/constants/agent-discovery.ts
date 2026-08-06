/**
 * The agent-discovery `Link` header (RFC 8288 / RFC 9727 section 3), pointing at
 * the API catalog, the OpenAPI document and the human docs. Relative URIs
 * resolve against the request, so no domain is hard-coded.
 *
 * Kept here, dependency-free, because it has two callers that cannot share much:
 * `next.config.ts` sets it on every page, and the Markdown route sets its own
 * `Link` (a header from the config REPLACES the handler's), so it has to append
 * this to its canonical rather than inherit it.
 */
export const AGENT_DISCOVERY_LINK =
  '</.well-known/api-catalog>; rel="api-catalog", ' +
  '</api/openapi.json>; rel="service-desc", ' +
  '</docs>; rel="service-doc"';

export default AGENT_DISCOVERY_LINK;
