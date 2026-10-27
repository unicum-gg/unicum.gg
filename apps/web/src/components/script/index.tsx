"use client";

import NextScript from "next/script";
import { useEffect, useState } from "react";
import STORAGE from "@/constants/storage";
import UMAMI from "@/constants/umami";
import { BOT_SIGNALS_SCRIPT } from "./bot-signals";
import { ENGAGEMENT_SCRIPT } from "./engagement";

/**
 * Two-tier analytics loading:
 *   - Umami runs in prod without consent: cookieless, no PII, no cross-site
 *     tracking, EU-hosted (cloud.umami.is). Treated as legitimate-interest
 *     internal analytics under GDPR.
 *   - GA4 only loads once the reader has accepted, read from the
 *     `CookieConsent` flag (see `@/contexts/cookie-consent`).
 *
 * There used to be a second path here, where AdSense pulled in Google's own
 * CMP and GA4 loaded unconditionally behind Consent Mode. Both are gone: the
 * site serves no ads, so it carried a consent manager, a Consent Mode default
 * block and a third-party ad script for nothing.
 */
export default function Script() {
  const [hasCustomConsent, setHasCustomConsent] = useState(false);

  useEffect(() => {
    const value = localStorage.getItem(STORAGE.LOCAL_STORAGE.COOKIE_CONSENT);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage on mount (no DOM API for it)
    setHasCustomConsent(value === "accepted" || value === "custom");
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE.LOCAL_STORAGE.COOKIE_CONSENT) {
        setHasCustomConsent(
          e.newValue === "accepted" || e.newValue === "custom",
        );
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      {/* Capture the visitor's Umami session id before the tracker loads: wrap
          `fetch` and read `sessionId` from the tracker's `/api/send` response
          (Umami returns it in plaintext), stashing it on a global the feedback
          widget reads. Inline + synchronous so it patches `fetch` ahead of the
          deferred tracker; pass-through for every non-Umami request. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var f=window.fetch;if(!f||window.__umamiFetchPatched)return;window.__umamiFetchPatched=1;window.fetch=function(){var p=f.apply(this,arguments);try{var a=arguments[0];var u=a&&(a.url||a);if(typeof u==='string'&&u.indexOf('umami')!==-1&&u.indexOf('/api/send')!==-1){p.then(function(r){r.clone().json().then(function(d){if(d&&d.sessionId)window.${UMAMI.SESSION_GLOBAL}=d.sessionId;}).catch(function(){});}).catch(function(){});}}catch(e){}return p;};})();`,
        }}
      />
      {/* Headless signals, posted on the global the tracker calls before each
          send. Inline and synchronous for the same reason as the patch above:
          the tracker is deferred but reads the global as soon as it runs, so it
          has to already be there. It cancels a payload on the signals measured
          to carry no readers and labels the rest, see `bot-signals`. */}
      <script dangerouslySetInnerHTML={{ __html: BOT_SIGNALS_SCRIPT }} />
      {/* The first human gesture of the page, reported as one custom event. It
          answers the question the probes above cannot, since the fleet they
          miss runs a real browser and is told apart by what it does rather
          than by what it is, see `engagement`. Inline and ahead of the tracker
          so a gesture made while the tracker is still loading is not lost. */}
      <script dangerouslySetInnerHTML={{ __html: ENGAGEMENT_SCRIPT }} />
      <NextScript
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id={UMAMI.WEBSITE_ID}
        data-before-send={UMAMI.BEFORE_SEND_GLOBAL}
      />

      {hasCustomConsent && (
        <>
          <NextScript
            strategy="afterInteractive"
            src="https://www.googletagmanager.com/gtag/js?id=G-7H98E5L74H"
          />
          <NextScript
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-7H98E5L74H');
              `,
            }}
          />
        </>
      )}
    </>
  );
}
