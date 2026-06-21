import type {
  BreadcrumbList,
  CollectionPage,
  DefinedTerm,
  FAQPage,
  ItemList,
  Organization,
  Person,
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
      "Free World of Tanks stats for every player and clan across EU, NA and Asia.",
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

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === SITE_URL ? SITE_URL : `${SITE_URL}${item.path}`,
    })),
  };
}

export function definedTermSchema(args: {
  name: string;
  description: string;
  url: string;
}): WithContext<DefinedTerm> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: args.name,
    description: args.description,
    url: `${SITE_URL}${args.url}`,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: `${SITE_NAME} metric glossary`,
      url: `${SITE_URL}/glossary`,
    },
  };
}

export function faqPageSchema(
  faqs: Array<{ question: string; answer: string }>,
): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function itemListSchema(args: {
  name: string;
  url: string;
  items: Array<{ name: string; path: string }>;
}): WithContext<ItemList> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.name,
    url: `${SITE_URL}${args.url}`,
    itemListElement: args.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}

export function collectionPageSchema(args: {
  name: string;
  description: string;
  url: string;
}): WithContext<CollectionPage> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: args.name,
    description: args.description,
    url: `${SITE_URL}${args.url}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
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
