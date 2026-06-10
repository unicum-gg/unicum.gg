"use client";

import NextScript from "next/script";
import { useEffect, useState } from "react";
import STORAGE from "@/constants/storage";

/**
 * Two-tier analytics loading:
 *   - Umami runs in prod without consent: cookieless, no PII, no cross-site
 *     tracking, EU-hosted (cloud.umami.is). Treated as legitimate-interest
 *     internal analytics under GDPR.
 *   - GA4 stays gated behind opt-in consent: cookies plus US data transfer,
 *     consent required.
 */
export default function Script() {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const value = localStorage.getItem(STORAGE.LOCAL_STORAGE.COOKIE_CONSENT);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage on mount (no DOM API for it)
    setHasConsent(value === "accepted" || value === "custom");

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE.LOCAL_STORAGE.COOKIE_CONSENT) {
        setHasConsent(e.newValue === "accepted" || e.newValue === "custom");
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
      {/* Umami: cookieless, always-on. */}
      <NextScript
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id="ddbebdb6-bb2f-4501-bd55-037e2410b943"
      />

      {/* Google Analytics: opt-in only. */}
      {hasConsent && (
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
