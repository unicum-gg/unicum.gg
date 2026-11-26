import { Region, REGION_WOT_HOST } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { WargamingHttpError } from "../../client/transport";
import { monthlyArticlePath, parseMonthlyCalendar, type PortalMonthlyEvent } from "./monthly";

/**
 * One entry of the portal home page's events widget ("This week's highlights"),
 * exactly as Wargaming wrote it. `color` and `icon` are the widget's own style
 * tokens (`green`/`azure`/`yellow`/`red`, `calendar-days`/`battle-pass`/`star`/
 * `arrow-down-to-line` when this was written) and are kept as strings, since the
 * set is Wargaming's to extend.
 */
export type PortalCalendarEvent = {
  title: string;
  /** Localized category label ("Specials", "Battle Pass", "Update", ...). */
  category: string;
  color: string;
  icon: string;
  start: Date;
  end: Date;
  /** When Wargaming last edited the entry. */
  editedAt: Date | null;
  /** The news article the entry points at, absolute. */
  link: string;
  /** The widget's own 200x88 thumbnail, absolute. */
  image: string | null;
  /** Whether the widget shows its countdown tag. */
  tag: boolean;
};

type RawCalendarEvent = {
  title?: unknown;
  category?: unknown;
  color?: unknown;
  icon?: unknown;
  start?: unknown;
  end?: unknown;
  edited?: unknown;
  link?: unknown;
  image?: unknown;
  tag?: unknown;
};

/**
 * Reads the JSON array literal starting at `from` (which must be a `[`) out of a
 * larger script, by matching brackets outside string literals. The widget passes
 * its events inline as `events: [...]` inside an object literal, so there is no
 * terminator to split on and no endpoint to ask instead.
 */
function readArrayLiteral(source: string, from: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return source.slice(from, i + 1);
  }
  return null;
}

const absolute = (url: string): string =>
  url.startsWith("//") ? `https:${url}` : url;

const epoch = (value: unknown): Date | null =>
  typeof value === "number" && value > 0 ? new Date(value * 1000) : null;

function parseEvent(raw: RawCalendarEvent): PortalCalendarEvent | null {
  const start = epoch(raw.start);
  const end = epoch(raw.end);
  if (typeof raw.title !== "string" || typeof raw.link !== "string") return null;
  if (!start || !end) return null;
  return {
    title: raw.title,
    category: typeof raw.category === "string" ? raw.category : "",
    color: typeof raw.color === "string" ? raw.color : "",
    icon: typeof raw.icon === "string" ? raw.icon : "",
    start,
    end,
    editedAt: epoch(raw.edited),
    link: absolute(raw.link),
    image: typeof raw.image === "string" && raw.image ? absolute(raw.image) : null,
    tag: raw.tag === true,
  };
}

/**
 * Thrown when the home page answered but no events widget could be read from
 * it. Carries what the page was instead (its title and size), since a page
 * without the widget is either Wargaming redesigning the portal or a challenge
 * served to the caller's address, and the two are fixed in different places.
 */
export class PortalCalendarMissingError extends Error {
  constructor(region: Region, html: string) {
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "no title";
    super(
      `No events widget on the ${region} portal home page (got "${title.slice(0, 120)}", ${html.length} chars)`,
    );
    this.name = "PortalCalendarMissingError";
  }
}

/**
 * The portal's events calendar (`worldoftanks.<tld>/<language>/`). It has no
 * endpoint: the home page server-renders the widget's events as a JSON array
 * passed to `EventsCalendar(options)`, and holds the current week only, so
 * nothing past it can be read back later.
 */
export class PortalEventsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /**
   * The widget's events, in the page language. Throws
   * {@link PortalCalendarMissingError} when the page no longer carries the
   * widget, which is a change on Wargaming's side rather than an empty week.
   */
  async calendar({
    language = "en",
  }: { language?: string } = {}): Promise<PortalCalendarEvent[]> {
    const url = new URL(`https://${REGION_WOT_HOST[this.region]}/${language}/`);
    const html = await this.t.getText(url, {
      region: this.region,
      limit: RateLimit.Portal,
    });
    const marker = /\bevents:\s*\[/.exec(html);
    const literal = marker
      ? readArrayLiteral(html, marker.index + marker[0].length - 1)
      : null;
    if (!literal) throw new PortalCalendarMissingError(this.region, html);
    const raw = JSON.parse(literal) as RawCalendarEvent[];
    return raw.flatMap((entry) => parseEvent(entry) ?? []);
  }

  /**
   * The `og:image` of a portal news article: the full-size banner (1022x360 on
   * the articles measured), where the widget only carries a 200x88 thumbnail.
   */
  async articleImage({ link }: { link: string }): Promise<string | null> {
    const html = await this.t.getText(new URL(link), {
      region: this.region,
      limit: RateLimit.Portal,
    });
    const tag = /<meta[^>]+property="og:image(?::url)?"[^>]*>/i.exec(html);
    const content = tag && /content="([^"]+)"/i.exec(tag[0]);
    return content ? absolute(content[1]) : null;
  }

  /**
   * A month's calendar from its "WoT Monthly" article (`month` is 1-12). Null
   * when the month has no article (not published yet, or never: a few months
   * were published under another address), an empty list when the article
   * predates the widget (before March 2025).
   */
  async monthly({
    year,
    month,
    language = "en",
  }: {
    year: number;
    month: number;
    language?: string;
  }): Promise<PortalMonthlyEvent[] | null> {
    const origin = `https://${REGION_WOT_HOST[this.region]}`;
    const url = new URL(`${origin}/${language}${monthlyArticlePath(year, month)}`);
    try {
      const html = await this.t.getText(url, {
        region: this.region,
        limit: RateLimit.Portal,
      });
      return parseMonthlyCalendar(html, origin);
    } catch (err) {
      if (err instanceof WargamingHttpError && err.status === 404) return null;
      throw err;
    }
  }
}
