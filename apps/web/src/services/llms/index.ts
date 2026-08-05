import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { getDocsSections } from "@/lib/docs-source";
import { MCP_NAME, renderOperations } from "@/services/mcp/skill";
import { TOOL_DEFS } from "@/services/mcp/tools";
import { StrongholdTier } from "@unicum.gg/shared";
import { Region, REGIONS } from "@unicum.gg/wargaming";

/**
 * `llms.txt` and its `llms-full.txt` companion.
 *
 * Google's June 2026 guidance is explicit that neither file influences Search
 * rankings, so this is not an SEO play: it is the entry point agents look for
 * (Anthropic's "writing for agents" guidance, OpenAI's Agents SDK, and Chrome's
 * Lighthouse "agentic browsing" audit all check `/llms.txt`). Its job is to hand
 * an agent the machine-readable surfaces we already serve, in one fetch, instead
 * of letting it scrape stat tables out of HTML.
 *
 * Everything below the prose is derived: the endpoint list comes from the same
 * generated OpenAPI document that feeds the docs, the SDK and the MCP server, so
 * documenting a new route publishes it here too.
 */
const abs = (path: string): string => `${APP.URL}${path}`;

/** A page's Markdown twin (see `proxy.ts` and `app/api/md`). */
const md = (path: string): string => abs(path === "/" ? "/index.md" : `${path}.md`);

/**
 * Sample entities used to show the URL shape rather than describe it. They only
 * have to stay resolvable, not current: a renamed player or retagged clan is
 * redirected to its new URL rather than 404ing.
 */
const SAMPLE = {
  PLAYER: "Animal",
  OTHER_PLAYER: "_rerolls",
  CLAN: "FAME",
  TANK: "is-7",
  MAP: "himmelsdorf",
};

type SiteSection = { title: string; url: string; blurb: string };

/**
 * The site's own map. Titles and blurbs are editorial, the paths are not: they
 * come from `ROUTES`, so a route rename cannot leave a dead link here.
 */
function siteSections(): SiteSection[] {
  const eu = Region.EU;
  return [
    {
      title: "Players",
      url: md(ROUTES.PLAYERS(eu)),
      blurb:
        "Leaderboards, and a profile per account: WN8, WNX, WTR, winrate, average damage, per-tank breakdown, rating history and every clan the player has been in.",
    },
    {
      title: "Player profile",
      url: md(ROUTES.PLAYER(eu, SAMPLE.PLAYER)),
      blurb:
        "Shape of a profile URL. Old nicknames redirect to the current one, so a stale link still resolves.",
    },
    {
      title: "Player comparison",
      url: md(ROUTES.COMPARE_PLAYERS(eu, [SAMPLE.PLAYER, SAMPLE.OTHER_PLAYER])),
      blurb: "Two or more accounts side by side on the same metrics.",
    },
    {
      title: "Clans",
      url: md(ROUTES.CLANS(eu)),
      blurb:
        "Clan leaderboards, and a page per clan: roster with each member's rating, average clan ratings, stronghold results and the clan's own rename history.",
    },
    {
      title: "Clan page",
      url: md(ROUTES.CLAN(eu, SAMPLE.CLAN)),
      blurb: "Shape of a clan URL. Clans are addressed by tag, case-insensitive.",
    },
    {
      title: "Stronghold leaderboard",
      // Tier-qualified on purpose: the bare `/clans/stronghold` redirects to
      // the default tier, and a redirect has no Markdown twin to convert.
      url: md(ROUTES.STRONGHOLD(eu, StrongholdTier.T10)),
      blurb: "Clan stronghold standings, per tier.",
    },
    {
      title: "Tanks",
      url: md(ROUTES.TANKS(eu)),
      blurb:
        "The full vehicle catalogue with filters, plus a page per tank: characteristics, crew skills, field modifications, equipment, marks of excellence thresholds and community averages.",
    },
    {
      title: "Tank page",
      url: md(ROUTES.TANK(eu, SAMPLE.TANK)),
      blurb: "Shape of a tank URL. Slugs are name-based and stable across regions.",
    },
    {
      title: "Maps",
      url: md(ROUTES.MAPS(eu)),
      blurb:
        "Every map in the random battle rotation, with its minimap, size, battle length, and base and spawn positions per game mode.",
    },
    {
      title: "Coverage",
      url: md(ROUTES.COVERAGE(eu)),
      blurb:
        "How much of each server we track: accounts known, accounts with snapshots, and how the coverage has grown.",
    },
    {
      title: "MCP server",
      url: md(ROUTES.MCP),
      blurb: "Setup instructions for Claude, Cursor and other MCP clients.",
    },
  ];
}

function prelude(): string[] {
  const regions = REGIONS.map((r) => `\`${r}\``).join(", ");
  return [
    `# ${APP.NAME}`,
    "",
    `> ${APP.DESCRIPTION}`,
    "",
    "Stats are read from the official Wargaming API and snapshotted continuously,",
    "so a profile carries its own history rather than a single point in time.",
    "Nothing here needs an account, an API key or a paywall, and every page renders",
    "server-side, so no JavaScript is required to read it.",
    "",
    "## Read any page as Markdown",
    "",
    "Every page has a Markdown twin. Append `.md` to its URL, or send",
    "`Accept: text/markdown`. The response carries an `x-markdown-tokens` header,",
    "so the cost of a page is known before its body is read.",
    "",
    `- ${md(ROUTES.PLAYER(Region.EU, SAMPLE.PLAYER))}`,
    `- ${md(ROUTES.CLAN(Region.EU, SAMPLE.CLAN))}`,
    `- ${md(ROUTES.TANK(Region.EU, SAMPLE.TANK))}`,
    `- ${md(ROUTES.MAP(Region.EU, SAMPLE.MAP))}`,
    "",
    "## Structured access",
    "",
    "Prefer these over reading the pages. They answer the same questions with",
    "typed payloads, and none of them need a key.",
    "",
    `- [MCP server](${abs("/api/mcp")}): Streamable HTTP transport exposing ${TOOL_DEFS.length} read-only tools, generated from the OpenAPI document below. Setup: ${md(ROUTES.MCP)}`,
    `- [Agent Skill](${abs(`/.well-known/agent-skills/${MCP_NAME}/SKILL.md`)}): the whole API as a single skill file, listed in [the skills index](${abs("/.well-known/agent-skills/index.json")}).`,
    `- [OpenAPI document](${abs("/api/openapi.json")}): the public read API in full, unauthenticated.`,
    `- [API reference](${md(ROUTES.DOCS)}): the same document rendered per endpoint, one page each.`,
    `- [API catalog](${abs("/.well-known/api-catalog")}): RFC 9727 linkset pointing at the spec, the docs and the health endpoint.`,
    `- [MCP server card](${abs("/.well-known/mcp/server-card.json")}): the server's identity and remote transport.`,
    "",
    "## Regions",
    "",
    "World of Tanks runs separate servers and an account exists on exactly one of",
    `them. The region is the first path segment (${regions}) and is required on`,
    "every entity: the same nickname on two servers is two different players.",
    "Paths without a region are EU shortcuts.",
    "",
    "## Sections",
    "",
    ...siteSections().map((s) => `- [${s.title}](${s.url}): ${s.blurb}`),
    "",
  ];
}

function indexes(): string[] {
  return [
    "## Indexes",
    "",
    `- [Sitemap index](${abs("/sitemap.xml")}): every player, clan, tank and map URL we serve, split per region and paginated.`,
    `- [robots.txt](${abs("/robots.txt")}): crawling and AI content-usage signals. Training and inference on this content are both allowed.`,
    "",
  ];
}

export async function generateLlmsTxt(): Promise<string> {
  const sections = await getDocsSections();
  const reference = sections.flatMap((section) => [
    `### ${section.name}`,
    "",
    ...section.pages.map(
      (page) =>
        `- [${page.title}](${md(page.url)})${page.description ? `: ${page.description}` : ""}`,
    ),
    "",
  ]);

  return [
    ...prelude(),
    "## API reference",
    "",
    `Base URL \`${abs("/api")}\`. Every endpoint is a GET returning JSON, apart from`,
    "the live channels, which stream Server-Sent Events.",
    "",
    ...reference,
    ...indexes(),
    "## Full reference",
    "",
    `- [llms-full.txt](${abs("/llms-full.txt")}): this file plus every endpoint's parameters inline, for a single-fetch read.`,
    "",
  ].join("\n");
}

export async function generateLlmsFullTxt(): Promise<string> {
  return [
    ...prelude(),
    "## API reference",
    "",
    `Base URL \`${abs("/api")}\`. Every endpoint is a GET returning JSON, apart from`,
    "the live channels, which stream Server-Sent Events. Each operation below is",
    "also exposed as an MCP tool, under the name given as its heading.",
    "",
    renderOperations(),
    "",
    ...indexes(),
  ].join("\n");
}
