import type {
  BreadcrumbList,
  Organization,
  Person,
  Product,
  SportsTeam,
  VideoObject,
  WebSite,
  WithContext,
} from "schema-dts";
import APP from "@/constants/app";

const SITE_URL = APP.URL;
const SITE_NAME = APP.NAME;
const LOGO_URL = APP.LOGO;

export function websiteSchema(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Free World of Tanks stats for every player, clan and tank across EU, NA and Asia.",
    inLanguage: "en",
  };
}

export function organizationSchema(): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    sameAs: Object.values(APP.EXTERNAL),
  };
}

export function personSchema(args: {
  nickname: string;
  region: string;
  url: string;
  description: string;
  clanName?: string | null;
}): WithContext<Person> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: args.nickname,
    url: args.url,
    description: args.description,
    identifier: `${args.region}/${args.nickname}`,
    ...(args.clanName && {
      memberOf: { "@type": "SportsTeam", name: args.clanName },
    }),
  };
}

export function tankSchema(args: {
  name: string;
  url: string;
  description: string;
  image?: string | null;
  tier: number;
  nation: string;
  type: string;
  isPremium: boolean;
}): WithContext<Product> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: args.name,
    url: args.url,
    description: args.description,
    category: "World of Tanks vehicle",
    brand: { "@type": "Brand", name: "World of Tanks" },
    ...(args.image && { image: args.image }),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Tier", value: args.tier },
      { "@type": "PropertyValue", name: "Nation", value: args.nation },
      { "@type": "PropertyValue", name: "Type", value: args.type },
      { "@type": "PropertyValue", name: "Premium", value: args.isPremium },
    ],
  };
}

/**
 * Breadcrumb trail (e.g. unicum.gg › Tanks › T-62A). Each `url` must be
 * absolute. Renders the SERP breadcrumb rich result across player/clan/tank
 * pages.
 */
export function breadcrumbSchema(
  items: { name: string; url: string }[],
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function clanSchema(args: {
  tag: string;
  name: string;
  region: string;
  membersCount: number;
  url: string;
  description: string;
  logo?: string | null;
}): WithContext<SportsTeam> {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: `[${args.tag}] ${args.name}`,
    alternateName: args.tag,
    url: args.url,
    description: args.description,
    identifier: `${args.region}/${args.tag}`,
    sport: "World of Tanks",
    numberOfEmployees: {
      "@type": "QuantitativeValue",
      value: args.membersCount,
    },
    ...(args.logo && { logo: args.logo }),
  };
}

/**
 * A community-suggested video and the battles marked in it.
 *
 * Deliberately without `uploadDate`. It is one of the three properties Google
 * requires for the video rich result, and the only source for it is the
 * YouTube Data API, which this feature does not call: oEmbed, which it does
 * call, returns the title, the channel and the thumbnail and nothing else.
 * Dating it from our own submission timestamp would be a false statement in
 * structured data, which is worth less than no statement at all. So this is
 * honest page semantics rather than a bid for a rich result, and it becomes one
 * the day a real publication date is stored.
 *
 * The clips point at YouTube rather than at our own page: `url` must reach the
 * start of the segment, and the timestamped watch link is the only address that
 * does today.
 */
export function tankVideoSchema(args: {
  videoId: string;
  name: string;
  thumbnailUrl: string;
  embedUrl: string;
  description: string;
  channelName: string;
  clips: { name: string; startSeconds: number; url: string }[];
}): WithContext<VideoObject> {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: args.name,
    description: args.description,
    thumbnailUrl: args.thumbnailUrl,
    embedUrl: args.embedUrl,
    creator: { "@type": "Person", name: args.channelName },
    hasPart: args.clips.map((clip) => ({
      "@type": "Clip" as const,
      name: clip.name,
      startOffset: clip.startSeconds,
      url: clip.url,
    })),
  };
}
