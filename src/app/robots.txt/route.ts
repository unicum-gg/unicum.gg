import APP from "@/constants/app";

/**
 * Plain-text robots.txt route handler.
 *
 * Next's typed `MetadataRoute.Robots` object cannot emit a `Content-Signal:`
 * line (it only supports allow/disallow/crawlDelay/sitemap/host), so we render
 * the file by hand here to declare AI content-usage preferences while keeping
 * the host and sitemap derived from the env-driven `APP.URL`.
 *
 * @see https://contentsignals.org/
 * @see https://datatracker.ietf.org/doc/draft-romm-aipref-contentsignals/
 */
export function GET(): Response {
  const body = [
    "User-Agent: *",
    "Allow: /",
    "Content-Signal: search=yes, ai-train=yes, ai-input=yes",
    "",
    `Sitemap: ${APP.URL}/sitemap.xml`,
    `Host: ${APP.URL}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
