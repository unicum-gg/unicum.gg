import sanitizeHtml from "sanitize-html";
import { type Region, type ClanEmblems } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type Emblems = ClanEmblems;

export function pickEmblem(emblems: Emblems): string {
  return (
    emblems?.x195?.portal ??
    emblems?.x64?.portal ??
    emblems?.x64?.wot ??
    emblems?.x32?.portal ??
    ""
  );
}

export type ClanFullInfo = {
  id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  motto: string;
  descriptionHtml: string;
  createdAt: Date;
  membersCount: number;
  leaderId: number;
  leaderName: string;
  creatorId: number;
  creatorName: string;
  isDisbanded: boolean;
  languages: string[];
  // Last time the clan's data was refreshed (from `clans.last_refreshed_at`);
  // drives the clan page's "Updated X ago" + refresh beacon. Null for a clan
  // never refreshed through the tracked pipeline.
  updatedAt: Date | null;
};

// Client-safe shape lives in `@unicum.gg/shared`; re-exported for back-compat.
import type { ClanRef } from "@unicum.gg/shared";
export type { ClanRef } from "@unicum.gg/shared";

const FULL_INFO_FIELDS = [
  "clan_id",
  "tag",
  "name",
  "color",
  "motto",
  "description_html",
  "members_count",
  "leader_id",
  "leader_name",
  "creator_id",
  "creator_name",
  "created_at",
  "is_clan_disbanded",
  "emblems",
] as const;

const SHORT_REF_FIELDS = ["clan_id", "tag", "name", "color", "emblems"] as const;

type RawFullInfo = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  motto: string;
  description_html: string;
  members_count: number;
  leader_id: number;
  leader_name: string;
  creator_id: number;
  creator_name: string;
  created_at: number;
  is_clan_disbanded: boolean;
  emblems: Emblems;
};
type RawShortRef = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblems: Emblems;
};

const DESCRIPTION_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "a", "ul", "ol", "li"],
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      // User-generated outbound links: nofollow so we neither pass link equity
      // to arbitrary sites nor reward spamming URLs into a clan description.
      rel: "nofollow noopener noreferrer",
    }),
  },
};
const URL_REGEX = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCT_REGEX = /([.,;:!?)\]}>]+)$/;
const DOUBLE_ENCODED_ENTITY_REGEX = /&amp;(#?\w+;)/g;
// Split into HTML tags and the text runs between them, so linkify only ever
// touches visible text and never the inside of a tag.
const TOKEN_REGEX = /<[^>]+>|[^<]+/g;

function linkifyText(text: string): string {
  return text.replace(URL_REGEX, (match) => {
    const trail = match.match(TRAILING_PUNCT_REGEX);
    const url = trail ? match.slice(0, -trail[0].length) : match;
    const tail = trail ? trail[0] : "";
    return `<a href="${url}">${url}</a>${tail}`;
  });
}

/**
 * Sanitize a WG clan description and turn bare URLs into links. WG wraps URLs in
 * tags (`<strong>https://…</strong>`), so a lookbehind that vetoes on a
 * preceding `>` would skip most of them. Instead we walk tag/text tokens and
 * linkify only text, tracking `<a>` depth so an existing anchor's visible text
 * is never double-wrapped. Idempotent, so it is safe to re-run on stored HTML.
 */
export function sanitizeClanDescription(html: string): string {
  const normalized = (html || "").replace(DOUBLE_ENCODED_ENTITY_REGEX, "&$1");
  let anchorDepth = 0;
  const linkified = (normalized.match(TOKEN_REGEX) ?? [])
    .map((token) => {
      if (token[0] === "<") {
        if (/^<a[\s/>]/i.test(token)) anchorDepth++;
        else if (/^<\/a\s*>/i.test(token))
          anchorDepth = Math.max(0, anchorDepth - 1);
        return token;
      }
      return anchorDepth > 0 ? token : linkifyText(token);
    })
    .join("");
  return sanitizeHtml(linkified, DESCRIPTION_SANITIZE_OPTIONS);
}

function isGhost(raw: RawFullInfo): boolean {
  return !raw.tag;
}

function clanFullInfoFromRaw(raw: RawFullInfo, languages: string[]): ClanFullInfo {
  return {
    id: raw.clan_id,
    tag: raw.tag || "",
    name: raw.name || "",
    color: raw.color || "",
    emblem: pickEmblem(raw.emblems),
    motto: raw.motto || "",
    descriptionHtml: sanitizeClanDescription(raw.description_html || ""),
    createdAt: new Date(raw.created_at * 1000),
    membersCount: raw.members_count,
    leaderId: raw.leader_id,
    leaderName: raw.leader_name || "",
    creatorId: raw.creator_id,
    creatorName: raw.creator_name || "",
    isDisbanded: raw.is_clan_disbanded,
    languages,
    // Fetched live from WG just now, so the data is current as of this moment.
    updatedAt: new Date(),
  };
}

function clanRefFromShort(raw: RawShortRef): ClanRef {
  return {
    id: raw.clan_id,
    tag: raw.tag || "",
    name: raw.name || "",
    color: raw.color || "",
    emblem: pickEmblem(raw.emblems),
    languages: [],
  };
}

const LANGUAGES_CONCURRENCY = 5;

async function clanLanguages(region: Region, clanId: number): Promise<string[]> {
  try {
    const profile = await wg.region(region).portal.clans.profile({ clanId });
    return profile.clanview?.profiles?.find((p) => p.type === "clan")?.languages_list ?? [];
  } catch {
    return [];
  }
}

export const getClanFullInfo = async (
  region: Region,
  clanId: number,
): Promise<ClanFullInfo | null> => {
  const [raw, languages] = await Promise.all([
    wg.region(region).api.wot.clans.info({ clanId, fields: FULL_INFO_FIELDS }),
    clanLanguages(region, clanId),
  ]);
  if (!raw || isGhost(raw)) return null;
  return clanFullInfoFromRaw(raw, languages);
};

export const getClansFullInfoBatch = async (
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanFullInfo>> => {
  const out = new Map<number, ClanFullInfo>();
  const unique = Array.from(new Set(clanIds));
  if (unique.length === 0) return out;
  const rawByClan = await wg
    .region(region)
    .api.wot.clans.infoBatch({ clanIds: unique, fields: FULL_INFO_FIELDS });
  const languagesMap = new Map<number, string[]>();
  for (let i = 0; i < unique.length; i += LANGUAGES_CONCURRENCY) {
    const batch = unique.slice(i, i + LANGUAGES_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (id) => [id, await clanLanguages(region, id)] as const),
    );
    for (const [id, langs] of results) languagesMap.set(id, langs);
  }
  for (const [id, raw] of rawByClan) {
    if (isGhost(raw)) continue;
    out.set(id, clanFullInfoFromRaw(raw, languagesMap.get(id) ?? []));
  }
  return out;
};

export const getClansShortRefBatch = async (
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanRef>> => {
  const out = new Map<number, ClanRef>();
  const rawByClan = await wg
    .region(region)
    .api.wot.clans.infoBatch({ clanIds, fields: SHORT_REF_FIELDS });
  for (const [id, raw] of rawByClan) {
    if (!raw.tag) continue;
    out.set(id, clanRefFromShort(raw));
  }
  return out;
};
