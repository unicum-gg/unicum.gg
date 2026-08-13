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
        <CookieConsentProvider>
          {children}
          <CookieConsent />
          <Script />
        </CookieConsentProvider>
      </RootProvider>
    </SWRConfig>
  );
}
