/**
 * The "WoT Monthly" article's calendar (`/news/general-news/wot-monthly-<month>-
 * <year>/`), a Gantt widget server-rendered into the article as one
 * `pcg-events_item` element per entry. Far richer than the home page widget
 * (tournaments, livestreams, national days, partner offers), dated by the day
 * rather than the minute, and kept online after its month: the widget format
 * runs from March 2025.
 */

/** One entry of a monthly calendar, as the article renders it. */
export type PortalMonthlyEvent = {
  /** Position in the article, which is the same in every language. */
  position: number;
  title: string;
  /** The article's category label, which Wargaming words loosely ("Livestream",
   * "Live Stream", "Stream"); the icon is the stable field. */
  category: string;
  color: string;
  icon: string;
  /** First day, `YYYY-MM-DD`. */
  startDate: string;
  /** Last day, `YYYY-MM-DD`, inclusive: a two-day final runs 7 to 8. */
  endDate: string;
  /** The popup's text, paragraphs separated by a blank line. */
  description: string;
  image: string | null;
  /** The "learn more" link, absolute, when the entry has one. */
  link: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Text content of an HTML fragment: tags dropped, entities decoded, spaces
 * collapsed. Decode-only, so nothing it returns is ever re-encoded. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === "#") {
        const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const attr = (attrs: string, name: string) =>
  new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The editors write some images protocol-relative (`//eu-wotp.wgcdn.co/...`),
 * which no consumer outside a browser page can load as is. */
const absoluteImage = (src: string | null): string | null =>
  !src ? null : src.startsWith("//") ? `https:${src}` : src;
const BUTTON = /<a\b[^>]*(?:event-btn|cta-button)[^>]*>/;

/**
 * Parse the monthly article's calendar. `origin` resolves the relative links
 * (`/en/tankopedia/...`). HTML comments are dropped first: the editors leave
 * publication notes in them, internal links included, which are not the page.
 */
export function parseMonthlyCalendar(html: string, origin: string): PortalMonthlyEvent[] {
  const source = html.replace(/<!--[\s\S]*?-->/g, "");
  const start = source.indexOf("pcg-events");
  if (start < 0) return [];
  const chunks = source.slice(start).split('<div class="pcg-events_item"').slice(1);
  const out: PortalMonthlyEvent[] = [];
  for (const chunk of chunks) {
    const close = chunk.indexOf(">");
    const attrs = chunk.slice(0, close);
    const body = chunk.slice(close + 1);
    const startDate = attr(attrs, "data-start-date");
    const endDate = attr(attrs, "data-end-date");
    const title = /pcg-events_item-title">([\s\S]*?)<\/div>/.exec(body)?.[1];
    if (!startDate || !endDate || !DATE.test(startDate) || !DATE.test(endDate) || !title) {
      continue;
    }
    const popupMatch = /pcg-events_item-popup"([^>]*)>([\s\S]*)/.exec(body);
    // The item closes its popup then itself; whatever follows is the next
    // section of the page (the last item has no next item to stop at).
    const popup = popupMatch
      ? [popupMatch[0], popupMatch[1], popupMatch[2].split(/<\/div>\s*<\/div>/)[0]]
      : null;
    const paragraphs = popup
      ? [...popup[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
          .map((m) => m[1])
          // The button paragraph is the link, not prose.
          .filter((p) => !BUTTON.test(p))
          .map(text)
          .filter(Boolean)
      : [];
    // The "learn more" button only (`event-btn` since 2026, `cta-button`
    // before): the prose links the vehicles it names to their Tankopedia page,
    // and those are not where the entry leads.
    const button = popup ? BUTTON.exec(popup[2])?.[0] : undefined;
    const href = button ? attr(button, "href") : null;
    let link: string | null = null;
    if (href && !href.includes("__PUBLICATION_URL")) {
      try {
        link = new URL(href, origin).toString();
      } catch {
        link = null;
      }
    }
    out.push({
      position: out.length,
      title: text(title),
      category: text(/pcg-events_item-category">([\s\S]*?)<\/div>/.exec(body)?.[1] ?? ""),
      color: attr(attrs, "data-category-color") ?? "",
      icon: attr(attrs, "data-category-icon") ?? "",
      startDate,
      endDate,
      description: paragraphs.join("\n\n"),
      image: absoluteImage(popup ? attr(popup[1], "data-preview-image") : null),
      link,
    });
  }
  return out;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** The article's path for a month (1-12), without its language segment. */
export const monthlyArticlePath = (year: number, month: number) =>
  `/news/general-news/wot-monthly-${MONTHS[month - 1]}-${year}/`;
