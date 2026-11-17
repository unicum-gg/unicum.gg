import type { NextConfig } from "next";

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
 * Each entry carries UTM parameters so the visit is attributable in Umami. A
 * partnership that cannot be measured can only be renewed on a feeling, and the
 * redirect is the one place every arrival passes through, so it is where the
 * attribution belongs rather than on the creator to append by hand.
 *
 * Written out by hand on purpose: a partnership is an agreement with a person,
 * not something derivable from the database. The list stays short and each line
 * is a deliberate act.
 */
const PARTNERS: { slug: string; region: string; nickname: string }[] = [
  { slug: "remi", region: "eu", nickname: "Remi_iD" },
  { slug: "ophacker", region: "na", nickname: "O_P_Hacker" },
];

// Language-neutral on purpose: the destination carries no locale prefix, so a
// viewer lands in whatever language the site negotiates for them rather than in
// the creator's. Their audience is not necessarily francophone.
export const partnerRedirects: NonNullable<
  Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>
> = PARTNERS.map(({ slug, region, nickname }) => ({
  source: `/${slug}`,
  destination: `/${region}/players/${nickname}?utm_source=twitch&utm_medium=overlay&utm_campaign=${slug}`,
  // Temporary: the target is a partnership, not a permanent fact about the URL.
  // A permanent redirect would be cached by browsers long after it ends.
  permanent: false,
}));
