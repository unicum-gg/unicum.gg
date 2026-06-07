"use client";

import Script from "@/components/script";
import { useCookieConsent } from "@/contexts/cookie-consent";

export function ScriptWrapper() {
  const { hasConsent } = useCookieConsent();

  if (!hasConsent) {
    return null;
  }

  return <Script />;
}
