/**
 * Vanity URLs for the creators we partner with: `unicum.gg/remi` lands on that
 * creator's own page on the site.
 *
 * They exist for one reason, and it is not tidiness. A stream overlay is video,
 * so nothing on it is ever clickable: the only thing it can do is make a URL
 * memorable enough that a viewer types it from memory later. A path anyone can
 * hold in their head is therefore the whole mechanism, and
 * `/fr/eu/players/Remi_iD` is not one.
 *
 * Written out by hand on purpose: a partnership is an agreement with a person,
 * not something derivable from the database. The list stays short and each line
 * is a deliberate act. The slug is the same one the kit is keyed by
 * (`apps/web/src/constants/partner-kits.ts`), so `/remi` and `/partners/remi`
 * always name the same person.
 *
 * It lives here rather than in the web app because two things need it and they
 * are in different packages: `proxy.ts` serves the redirect, and the worker's
 * `partner-hits` script names the slugs it reads the tallies of. It holds no
 * import of its own, so the proxy's hot path pays nothing for it.
 *
 * The redirect is no longer served from `next.config`, and the ordering is what
 * forced that: Next runs `redirects` from the config BEFORE the proxy, so a
 * config entry means the proxy never sees the path and no click can ever be
 * counted. See `hits.ts` beside this for what is counted instead.
 */
export type Partner = { slug: string; region: string; nickname: string };

export const PARTNERS: Partner[] = [
  { slug: "remi", region: "eu", nickname: "Remi_iD" },
  { slug: "ophacker", region: "na", nickname: "O_P_Hacker" },
  { slug: "orzanel", region: "eu", nickname: "Orzanel" },
  { slug: "kajzoo", region: "eu", nickname: "_kajzoo_" },
];

/** Keyed by the path itself, so the proxy's test is one map lookup on a string
 * it already has rather than a loop over the list on every request. */
export const PARTNER_BY_PATH = new Map<string, Partner>(
  PARTNERS.map((partner) => [`/${partner.slug}`, partner]),
);

/**
 * Where a vanity URL lands, with the attribution the visit carries.
 *
 * Language-neutral on purpose: the destination carries no locale prefix, so a
 * viewer lands in whatever language the site negotiates for them rather than in
 * the creator's. Their audience is not necessarily francophone.
 *
 * The UTM parameters are kept now that the redirect counts its own hits,
 * because they answer a question the counter cannot: the counter says how many
 * arrived, and the campaign on the URL is what ties a page view further into
 * the session back to the creator who sent it.
 */
export function partnerDestination(partner: Partner): {
  pathname: string;
  utm: Record<string, string>;
} {
  return {
    pathname: `/${partner.region}/players/${partner.nickname}`,
    utm: {
      utm_source: "twitch",
      utm_medium: "overlay",
      utm_campaign: partner.slug,
    },
  };
}
