// Installs the build-time SDK loopback (side-effect import, server graph only:
// prerendered pages resolve SDK calls against this build's own route handlers).
import "@/services/sdk/loopback";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { NavigationProgress } from "@/components/navigation-progress";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_RATING_METRIC } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { constructMetadata } from "@/lib/metadata";
import { organizationSchema, websiteSchema } from "@/lib/schema-org";
import { WebMcp } from "@/components/script/webmcp";
import { Provider } from "./provider";
import "./globals.css";
import ROUTES from "@/constants/routes";
import { Region } from "@unicum.gg/wargaming";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "World of Tanks player, clan & tank stats",
    // Site-wide default; per-page generateMetadata overrides this.
    canonical: ROUTES.HOME(Region.EU),
  });
}

// Inline script ran before paint so CSS rules keyed on
// `html[data-rating-metric]` match the user's choice immediately. The
// server can't read the cookie any more (touching `cookies()` would
// opt every page out of static generation), so the value is hydrated
// from the cookie client-side. `RatingMetricRoot` keeps the attribute
// in sync after cookie changes during the session.
const INITIAL_METRIC_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${STORAGE.COOKIES.RATING.replace(/\./g, "\\.")}=([^;]+)/);var v=m?decodeURIComponent(m[1]):${JSON.stringify(DEFAULT_RATING_METRIC)};if(v==='wn7'||v==='wn8'||v==='wnx'){document.documentElement.dataset.ratingMetric=v;}else{document.documentElement.dataset.ratingMetric=${JSON.stringify(DEFAULT_RATING_METRIC)};}}catch(e){document.documentElement.dataset.ratingMetric=${JSON.stringify(DEFAULT_RATING_METRIC)};}})();`;

// Ran before the app boots, which is the whole point of it being here.
//
// The video player's YouTube provider keeps a promise per command it has sent
// the iframe and not yet had confirmed, and its `destroy()` rejects every one
// of them with the string `"provider destroyed"`. Closing a video therefore
// throws a handful of rejections for commands that were merely in flight, and
// they are unhandled by construction: the library created most of those
// promises for itself, so there is no call site anywhere to attach a `catch`
// to. In development they surface as a red "Runtime Error" overlay on every
// close, which trains you to ignore the overlay.
//
// It has to run first, not just early: `preventDefault` stops the browser
// logging the rejection but not other listeners, and the dev overlay registers
// its own when the client bundle boots. `stopImmediatePropagation` is what
// keeps it from ever seeing this one.
//
// Matched on that exact reason and nothing else, so a real rejection, including
// any other failure from the same player, still surfaces normally.
const SILENCE_PLAYER_TEARDOWN_SCRIPT = `addEventListener('unhandledrejection',function(e){if(e.reason==='provider destroyed'){e.stopImmediatePropagation();e.preventDefault();}});`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The shell only: fonts, providers, global schema + toasts. The site chrome
  // (top bar, nav, footer) lives in the `(site)` route group so standalone
  // sections like `/docs` (its own fumadocs DocsLayout) can opt out of it.
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
        <script
          dangerouslySetInnerHTML={{
            __html: SILENCE_PLAYER_TEARDOWN_SCRIPT,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden antialiased">
        <NavigationProgress />
        <JsonLd data={websiteSchema()} />
        <JsonLd data={organizationSchema()} />
        <Provider>
          <WebMcp />
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
