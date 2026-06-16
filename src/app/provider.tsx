"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { CookieConsent } from "@/components/cookie-consent";
import Script from "@/components/script";
import { CookieConsentProvider } from "@/contexts/cookie-consent";

// Single switch: pick which CMP drives consent.
//   true  → Google CMP (Funding Choices, configured in AdSense).
//   false → our own CookieConsent banner + provider.
const USE_GOOGLE_CMP = true;

const SearchDialog = dynamic(
  () => import("@/components/search/dialog"),
);

export function Provider({ children }: { children: ReactNode }) {
  return (
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
  );
}
