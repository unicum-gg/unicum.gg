// Installs the in-process SDK loopback (side-effect import, server graph only):
// server-side SDK calls dispatch straight to this build's route handlers instead
// of self-fetching over HTTP, at build (prerender) and at runtime (SSR/ISR).
import "@/services/sdk/loopback";
import { GeistMono } from "geist/font/mono";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { NavigationProgress } from "@/components/navigation-progress";
import { Provider } from "@/components/provider";
import { WebMcp } from "@/components/script/webmcp";
import { Toaster } from "@/components/ui/sonner";
import STORAGE from "@/constants/storage";
import { organizationSchema, websiteSchema } from "@/lib/schema-org";
import {
  isClientNamespace,
  localeDir,
  type Locale,
} from "@/lib/translations";
import { getDictionaries } from "@/lib/translations.server";
import { DEFAULT_RATING_METRIC } from "@unicum.gg/shared";
import "@/app/globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
});

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

/**
 * The document itself: fonts, the pre-paint scripts, the global schema, the
 * providers. Rendered by the two root layouts, which is why it is a component
 * rather than one of them.
 *
 * There are two because there are two kinds of page. The site lives under
 * `app/[locale]` and takes its language from the route. `/docs` does not: the
 * reference is generated from the OpenAPI document, so there is nothing there to
 * translate, and giving it 27 addresses would only invite a crawler to read the
 * same English page 27 times.
 */
export async function Document({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  // Everything the browser needs, and nothing it does not: the three heavy
  // server-only namespaces stay behind (see `SERVER_ONLY_NAMESPACES`).
  const all = await getDictionaries(locale);
  const dictionaries = Object.fromEntries(
    Object.entries(all).filter(([namespace]) => isClientNamespace(namespace)),
  ) as typeof all;

  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      data-rating-metric={DEFAULT_RATING_METRIC}
      className={`${figtree.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      {/* eslint-disable-next-line @next/next/no-head-element -- the rule is
          about the Pages Router's `next/head`; an App Router root layout renders
          `<head>` itself, and these two scripts have to run before paint. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: INITIAL_METRIC_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{ __html: SILENCE_PLAYER_TEARDOWN_SCRIPT }}
        />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden antialiased">
        <NavigationProgress />
        <JsonLd data={websiteSchema()} />
        <JsonLd data={organizationSchema()} />
        <Provider locale={locale} dictionaries={dictionaries}>
          <WebMcp />
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
