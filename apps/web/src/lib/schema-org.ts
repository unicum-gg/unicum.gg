import type {
  AggregateRating,
  BreadcrumbList,
  ItemList,
  Organization,
  Person,
  Product,
  Review,
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

/**
 * Ratings a vehicle needs before we will state an average in structured data.
 *
 * Not a Google requirement: `aggregateRating` is valid from a single rating,
 * and the rich result would happily print a five-star tank that one person
 * voted on. That is technically true and practically a lie in a result page,
 * and a search engine that learns our ratings are thin is a search engine that
 * stops trusting all of them. The page itself has no such floor: it shows the
 * count next to the average, so a reader can weigh it. A search result cannot.
 */
export const MIN_RATINGS_FOR_SCHEMA = 5;

/** The five-star scale the community ratings are cast on. Stated explicitly
 * rather than left to Google's defaults, which happen to match today. */
const RATING_SCALE = { bestRating: 5, worstRating: 1 } as const;

export type TankRatingSummaryForSchema = {
  /** The plain mean, which is the figure printed on the page. Never the shrunk
   * one: structured data has to say what a reader can see. */
  average: number | null;
  votes: number;
  reviews: number;
};

function aggregateRatingOf(
  rating: TankRatingSummaryForSchema | null | undefined,
): AggregateRating | null {
  if (
    !rating ||
    rating.average == null ||
    rating.votes < MIN_RATINGS_FOR_SCHEMA
  ) {
    return null;
  }
  return {
    "@type": "AggregateRating",
    // Rounded to the two decimals the page prints, so the markup and the pixels
    // cannot disagree.
    ratingValue: Number(rating.average.toFixed(2)),
    // Both counts, and they are different facts: every vote is a rating, only
    // some carry a written review. Collapsing them would overstate one.
    ratingCount: rating.votes,
    ...(rating.reviews > 0 && { reviewCount: rating.reviews }),
    ...RATING_SCALE,
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
  /** The community's verdict, when there is enough of one to state. Carried on
   * every tab because the score is in the hero on every tab, which is the
   * visibility rule Google actually enforces. */
  rating?: TankRatingSummaryForSchema | null;
}): WithContext<Product> {
  const aggregateRating = aggregateRatingOf(args.rating);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    // The identity the review node on the Community tab attaches to, so the two
    // are read as one vehicle rather than two.
    "@id": args.url,
    name: args.name,
    url: args.url,
    description: args.description,
    category: "World of Tanks vehicle",
    brand: { "@type": "Brand", name: "World of Tanks" },
    ...(args.image && { image: args.image }),
    ...(aggregateRating && { aggregateRating }),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Tier", value: args.tier },
      { "@type": "PropertyValue", name: "Nation", value: args.nation },
      { "@type": "PropertyValue", name: "Type", value: args.type },
      { "@type": "PropertyValue", name: "Premium", value: args.isPremium },
    ],
  };
}

/**
 * The written opinions on a vehicle, attached to it by `@id`.
 *
 * A node of its own rather than a field on `tankSchema`, because the two are
 * emitted from different places for a reason Google is strict about: the score
 * is in the hero on every tab, so the aggregate may be stated on every tab, but
 * the review text only exists on the Community tab, and marking up content that
 * is not on the page is the fastest way to lose the rich result entirely.
 *
 * Each review carries its author as a `Person` pointing at their own profile
 * here, which is both what Google asks for and the honest statement: these are
 * players with a record on the tank, not anonymous handles.
 *
 * No `name` on the reviews. A review headline is a thing we do not collect, and
 * inventing one would be putting words in a player's mouth in markup.
 */
export function tankReviewsSchema(args: {
  tankName: string;
  tankUrl: string;
  reviews: {
    author: string;
    authorUrl: string;
    rating: number;
    body: string;
    datePublished: Date;
  }[];
}): WithContext<Product> | null {
  if (args.reviews.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": args.tankUrl,
    // Repeated so the node still names what is being reviewed for any consumer
    // that does not merge on `@id`.
    name: args.tankName,
    url: args.tankUrl,
    review: args.reviews.map(
      (r): Review => ({
        "@type": "Review",
        author: {
          "@type": "Person",
          // Google caps the reviewer name at 100 characters; a WG nickname is
          // far shorter, but the markup should not depend on that staying true.
          name: r.author.slice(0, 100),
          url: r.authorUrl,
        },
        datePublished: r.datePublished.toISOString(),
        reviewBody: r.body,
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          ...RATING_SCALE,
        },
      }),
    ),
  };
}

/**
 * An ordered list of things, for a page whose content is a ranking.
 *
 * `ItemList` is the only honest description of the community board: it is not
 * one product, it is sixty of them in an order that means something. Positions
 * are one-based, and each entry points at the page that actually holds the
 * verdict rather than repeating it here.
 */
export function itemListSchema(args: {
  name: string;
  description: string;
  items: { name: string; url: string }[];
}): WithContext<ItemList> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.name,
    description: args.description,
    numberOfItems: args.items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: args.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
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
