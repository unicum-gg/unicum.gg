"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { CookieConsent } from "@/components/cookie-consent";
import Script from "@/components/script";
import { CookieConsentProvider } from "@/contexts/cookie-consent";
import STORAGE from "@/constants/storage";
import { swrConfig } from "@/services/swr";

// Single switch: pick which CMP drives consent.
//   true  → Google CMP (Funding Choices, configured in AdSense).
//   false → our own CookieConsent banner + provider.
const USE_GOOGLE_CMP = true;

const SearchDialog = dynamic(
  () => import("@/components/search/dialog"),
);

export function Provider({ children }: { children: ReactNode }) {
  // One-shot cleanup of a pre-migration orphan: the region used to be stored in
  // localStorage under `unicum.region`, then moved to a cookie of the same name
  // without removing the old entry, so it lingers as dead data for returning
  // visitors (nothing reads it). Purge it so the only region store is the cookie.
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE.COOKIES.REGION);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  return (
    <SWRConfig value={swrConfig}>
      <RootProvider search={{ SearchDialog }}>
        {USE_GOOGLE_CMP ? (
          <>
            {children}
            <Script useGoogleCMP />
          </>
        ) : (
          <CookieConsentProvider>
            {children}
            <CookieConsent />
            <Script useGoogleCMP={false} />
          </CookieConsentProvider>
        )}
      </RootProvider>
    </SWRConfig>
  );
}
