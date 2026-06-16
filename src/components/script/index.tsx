"use client";

import NextScript from "next/script";
import { useEffect, useState } from "react";
import STORAGE from "@/constants/storage";

/**
 * Two-tier analytics loading:
 *   - Umami runs in prod without consent: cookieless, no PII, no cross-site
 *     tracking, EU-hosted (cloud.umami.is). Treated as legitimate-interest
 *     internal analytics under GDPR.
 *   - GA4 + AdSense gating depends on which CMP is active (see `useGoogleCMP`).
 *
 * When `useGoogleCMP` is true: load Google Consent Mode v2 defaults +
 * AdSense (which pulls in Google CMP) + always-on GA4 (Consent Mode
 * gates cookies + events based on the user's CMP choice).
 *
 * When `useGoogleCMP` is false: skip AdSense, gate GA4 on the custom
 * CookieConsent localStorage flag (see `@/contexts/cookie-consent`).
 */
export default function Script({ useGoogleCMP }: { useGoogleCMP: boolean }) {
  const [hasCustomConsent, setHasCustomConsent] = useState(false);

  useEffect(() => {
    if (useGoogleCMP) return;
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
  }, [useGoogleCMP]);

  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      <NextScript
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id="ddbebdb6-bb2f-4501-bd55-037e2410b943"
      />

      {useGoogleCMP ? (
        <>
          {/* Inline (not next/script): must populate dataLayer before
              gtag.js / adsbygoogle.js process anything. next/script's
              beforeInteractive only works inside the root server layout,
              not in a "use client" tree. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',personalization_storage:'granted',security_storage:'granted',wait_for_update:500});gtag('set','ads_data_redaction',true);`,
            }}
          />

          <NextScript
            id="adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3691404603790195"
          />

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
      ) : (
        hasCustomConsent && (
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
        )
      )}
    </>
  );
}
