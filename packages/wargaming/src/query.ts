import type { WgLanguage } from "./language";

/**
 * The parameters shared by (almost) every WG endpoint. Resources pass their
 * options straight through; `buildQuery` maps the camelCase option names to
 * WG's snake_case query keys and serializes arrays as comma-separated lists.
 * Endpoint-specific keys (`account_id`, `clan_id`, `search`, …) are set by the
 * caller on the returned record.
 */
export type CommonQuery = {
  /** Response fields to keep (dotted paths), serialized as a CSV `fields` param. */
  fields?: readonly string[];
  /** Extra response blocks, serialized as a CSV `extra` param. */
  extra?: readonly string[];
  /** Localization (`language`). */
  language?: WgLanguage;
  /** Private-data access token (`access_token`). */
  accessToken?: string;
  /** Page size (`limit`). */
  limit?: number;
  /** 1-based page number (`page_no`). */
  pageNo?: number;
  /** Sort key (`order_by`). */
  orderBy?: string;
};

export function buildQuery(params: CommonQuery = {}): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.fields?.length) query.fields = params.fields.join(",");
  if (params.extra?.length) query.extra = params.extra.join(",");
  if (params.language) query.language = params.language;
  if (params.accessToken) query.access_token = params.accessToken;
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.pageNo !== undefined) query.page_no = String(params.pageNo);
  if (params.orderBy) query.order_by = params.orderBy;
  return query;
}
