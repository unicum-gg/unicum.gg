import type {
  BreadcrumbList,
  Organization,
  Person,
  Product,
  SportsTeam,
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
