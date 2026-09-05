import sanitizeHtml from "sanitize-html";

/**
 * Organiser-authored HTML, made safe to render.
 *
 * A tournament's rules and description are written by whoever runs it, in a rich
 * text editor, and they reach us as raw markup. They are worth rendering (the
 * rules are where the side convention and the match configuration are actually
 * stated) but they are third-party input, so they are sanitized here, on the
 * server, rather than trusted at the point they are injected into the DOM.
 *
 * A wider tag set than the clan description allows, because these are documents
 * rather than one-line blurbs: headings, lists and tables all appear in real
 * tournament rules and dropping them would leave the text unreadable.
 */
const RULES_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "a", "ul", "ol", "li",
    "h2", "h3", "h4", "blockquote", "code", "pre", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      // Third-party outbound links: nofollow, so we neither pass link equity to
      // arbitrary sites nor reward dropping URLs into a tournament description.
      rel: "nofollow noopener noreferrer",
    }),
  },
};

export function sanitizeTournamentHtml(html: string): string {
  return sanitizeHtml(html, RULES_SANITIZE_OPTIONS);
}
