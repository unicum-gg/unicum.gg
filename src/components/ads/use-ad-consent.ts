"use client";

import { useSyncExternalStore } from "react";

// Reads the Consent Mode v2 ad_storage signal that drives ad eligibility.
// Prod plumbing (`src/components/script/index.tsx`, USE_GOOGLE_CMP) seeds
// gtag('consent','default',{ad_storage:'denied',...}) and Funding Choices
// later pushes gtag('consent','update',{ad_storage:'granted'}). Both land on
// window.dataLayer, so dataLayer is the single source of truth for whether an
// ad request may fire. Until ad_storage is 'granted' this stays false and the
// AdUnit never pushes to adsbygoogle, so no ad request leaves the page.

type DataLayerWindow = Window & { dataLayer?: unknown[] };

let installed = false;
const listeners = new Set<() => void>();

function ensureInstalled(): void {
  if (installed || typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  const arr = (w.dataLayer = w.dataLayer ?? []);
  const target = arr as { push: (...args: unknown[]) => number };
  const originalPush = target.push.bind(arr) as (...args: unknown[]) => number;
  target.push = (...args: unknown[]): number => {
    const result = originalPush(...args);
    for (const listener of listeners) listener();
    return result;
  };
  installed = true;
}

function subscribe(onChange: () => void): () => void {
  ensureInstalled();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const dl = (window as DataLayerWindow).dataLayer;
  if (!Array.isArray(dl)) return false;
  let granted = false;
  for (const raw of dl) {
    const entry = raw as Record<number, unknown>;
    if (
      entry &&
      entry[0] === "consent" &&
      (entry[1] === "default" || entry[1] === "update")
    ) {
      const params = entry[2] as { ad_storage?: unknown } | undefined;
      if (params && typeof params.ad_storage === "string") {
        granted = params.ad_storage === "granted";
      }
    }
  }
  return granted;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useAdConsent(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
