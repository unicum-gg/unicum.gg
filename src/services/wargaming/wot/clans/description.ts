import sanitizeHtml from "sanitize-html";

const DESCRIPTION_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "a", "ul", "ol", "li"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
};

const URL_REGEX = /(?<!["'=>])(https?:\/\/[^\s<>"']+)/g;
const TRAILING_PUNCT_REGEX = /([.,;:!?)\]}>]+)$/;
const DOUBLE_ENCODED_ENTITY_REGEX = /&amp;(#?\w+;)/g;

function linkifyPlainUrls(html: string): string {
  return html.replace(URL_REGEX, (match) => {
    const trail = match.match(TRAILING_PUNCT_REGEX);
    const url = trail ? match.slice(0, -trail[0].length) : match;
    const tail = trail ? trail[0] : "";
    return `<a href="${url}">${url}</a>${tail}`;
  });
}

function unescapeDoubleEntities(html: string): string {
  return html.replace(DOUBLE_ENCODED_ENTITY_REGEX, "&$1");
}

export function sanitizeClanDescription(html: string): string {
  return sanitizeHtml(
    linkifyPlainUrls(unescapeDoubleEntities(html ?? "")),
    DESCRIPTION_SANITIZE_OPTIONS,
  );
}
