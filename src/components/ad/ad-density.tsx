"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AD_DESKTOP_MIN_WIDTH, AD_MAX_UNITS } from "./ad-config";

/**
 * Page-level density guard. Wrap a page (or layout) in AdDensityProvider and every
 * AdSlot inside it calls useAdSlotAllowed() to claim a slot. Once the per-viewport
 * cap (3 desktop / 2 mobile) is reached, further slots are denied and render nothing.
 * This is the "no more than N units per page" rule, and it deliberately excludes
 * interstitials and auto-anchor (we do not mount those at all).
 */
interface AdDensityContextValue {
  claim: () => boolean;
  release: () => void;
}

const AdDensityContext = createContext<AdDensityContextValue | null>(null);

export function AdDensityProvider({ children }: { children: ReactNode }) {
  const countRef = useRef(0);

  const claim = useCallback(() => {
    const cap =
      typeof window !== "undefined" && window.innerWidth >= AD_DESKTOP_MIN_WIDTH
        ? AD_MAX_UNITS.desktop
        : AD_MAX_UNITS.mobile;
    if (countRef.current >= cap) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[AdSlot] density cap of ${cap} reached; refusing to mount extra unit`,
        );
      }
      return false;
    }
    countRef.current += 1;
    return true;
  }, []);

  const release = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
  }, []);

  return (
    <AdDensityContext.Provider value={{ claim, release }}>
      {children}
    </AdDensityContext.Provider>
  );
}

/**
 * Returns whether this slot is allowed to render.
 *   - null  while undecided (first render): the caller renders its reserved
 *     container so server and client markup match.
 *   - true  once the slot has claimed a place under the density cap.
 *   - false when the cap is exceeded: the caller renders nothing.
 * Without a provider every slot is allowed (the placement owns the count).
 */
export function useAdSlotAllowed(): boolean | null {
  const ctx = useContext(AdDensityContext);
  const [allowed, setAllowed] = useState<boolean | null>(ctx ? null : true);

  useEffect(() => {
    if (!ctx) return;
    const ok = ctx.claim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot density claim on mount; the count lives in an external ref, not derivable during render
    setAllowed(ok);
    return () => {
      if (ok) ctx.release();
    };
  }, [ctx]);

  return allowed;
}
