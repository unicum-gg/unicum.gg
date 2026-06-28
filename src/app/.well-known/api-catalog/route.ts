import APP from "@/constants/app";

/**
 * API catalog for automated discovery (RFC 9727), serialized as a linkset
 * (RFC 9264). Fully derived from `APP.URL` so it never needs hand-maintenance:
 * the single source of truth for endpoints is the OpenAPI document linked via
 * `service-desc`.
 */
export function GET(): Response {
  const linkset = [
    {
      anchor: `${APP.URL}/api`,
      "service-desc": [
        {
          href: `${APP.URL}/api/openapi.json`,
          type: "application/openapi+json",
        },
      ],
      "service-doc": [
        {
          href: `${APP.URL}/docs`,
          type: "text/html",
        },
      ],
      status: [
        {
          href: `${APP.URL}/api/health`,
          type: "application/json",
        },
      ],
    },
  ];

  return new Response(JSON.stringify({ linkset }, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
