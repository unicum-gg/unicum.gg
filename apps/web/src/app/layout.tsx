// Installs the build-time SDK loopback (side-effect import, server graph only:
// prerendered pages resolve SDK calls against this build's own route handlers).
import "@/services/sdk/loopback";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { TopBar } from "@/components/top-bar";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { NavDebug } from "@/components/nav-debug";
import { RatingMetricRoot } from "@/components/rating-metric-root";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_RATING_METRIC } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { baseOptions } from "@/lib/layout.shared";
import { constructMetadata } from "@/lib/metadata";
import { organizationSchema, websiteSchema } from "@/lib/schema-org";
import { WebMcp } from "@/components/script/webmcp";
import { Provider } from "./provider";
import "./globals.css";
import ROUTES from "@/constants/routes";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "World of Tanks player, clan & tank stats",
    // Site-wide default; per-page generateMetadata overrides this.
    canonical: ROUTES.HOME,
  });
}

// Inline script ran before paint so CSS rules keyed on
// `html[data-rating-metric]` match the user's choice immediately. The
// server can't read the cookie any more (touching `cookies()` would
// opt every page out of static generation), so the value is hydrated
// from the cookie client-side. `RatingMetricRoot` keeps the attribute
// in sync after cookie changes during the session.
const INITIAL_METRIC_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${STORAGE.COOKIES.RATING.replace(/\./g, "\\.")}=([^;]+)/);var v=m?decodeURIComponent(m[1]):${JSON.stringify(DEFAULT_RATING_METRIC)};if(v==='wn7'||v==='wn8'||v==='wnx'){document.documentElement.dataset.ratingMetric=v;}else{document.documentElement.dataset.ratingMetric=${JSON.stringify(DEFAULT_RATING_METRIC)};}}catch(e){document.documentElement.dataset.ratingMetric=${JSON.stringify(DEFAULT_RATING_METRIC)};}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const layoutProps = await baseOptions();
  return (
    <html
      lang="en"
      data-rating-metric={DEFAULT_RATING_METRIC}
      className={`${figtree.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: INITIAL_METRIC_SCRIPT }}
        />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden antialiased">
        <JsonLd data={websiteSchema()} />
        <JsonLd data={organizationSchema()} />
        <Provider>
          <WebMcp />
          <NavDebug />
          <RatingMetricRoot />
          <TopBar />
          <HomeLayout {...layoutProps}>
            <div id="page-content" className="flex flex-1 flex-col">{children}</div>
            <Footer />
          </HomeLayout>
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
