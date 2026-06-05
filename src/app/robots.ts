import type { MetadataRoute } from "next";
import APP from "@/constants/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${APP.URL}/sitemap.xml`,
    host: APP.URL,
  };
}
