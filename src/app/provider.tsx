"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { CookieConsent } from "@/components/cookie-consent";
import Script from "@/components/script";
import { CookieConsentProvider } from "@/contexts/cookie-consent";

const SearchDialog = dynamic(
  () => import("@/components/search/dialog"),
);

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog }}>
      <CookieConsentProvider>
        {children}
        <CookieConsent />
        <Script />
      </CookieConsentProvider>
    </RootProvider>
  );
}
