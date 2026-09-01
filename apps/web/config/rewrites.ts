import type { NextConfig } from "next";

// The sitemap index publishes pretty `<…>/sitemap-N.xml` URLs (file-like,
// matches the sitemap convention). App Router can only use `[id]` as a
// whole folder name, so the actual route handlers live under
// `<…>/sitemap.xml/[id]/`. These rewrites bridge the two without forcing
// the external URLs to look like `/.../sitemap.xml/0`.
export const rewrites: NextConfig["rewrites"] = async () => [
  { source: "/sitemap-:id.xml", destination: "/sitemap.xml/:id" },
  {
    source: "/:region(eu|na|asia)/clans/sitemap-:id.xml",
    destination: "/:region/clans/sitemap.xml/:id",
  },
  {
    source: "/:region(eu|na|asia)/players/sitemap-:id.xml",
    destination: "/:region/players/sitemap.xml/:id",
  },
  {
    source: "/:region(eu|na|asia)/tournaments/sitemap-:id.xml",
    destination: "/:region/tournaments/sitemap.xml/:id",
  },
  {
    source: "/:region(eu|na|asia)/tanks/sitemap-:id.xml",
    destination: "/:region/tanks/sitemap.xml/:id",
  },
];
