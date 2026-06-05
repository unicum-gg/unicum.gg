import type {
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
