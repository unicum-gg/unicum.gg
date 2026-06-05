import { createSitemapHandler } from "@onruntime/next-sitemap/app";
import { sitemapConfig } from "@/services/sitemap";

export const dynamic = "force-static";

const { generateStaticParams, GET } = createSitemapHandler(sitemapConfig);

export { generateStaticParams, GET };
