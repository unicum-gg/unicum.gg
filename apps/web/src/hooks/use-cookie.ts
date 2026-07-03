"use client";

import Cookies from "js-cookie";
import { useCallback, useEffect, useState } from "react";

const ONE_YEAR_DAYS = 365;
const CHANGE_EVENT = "unicum:cookie-change";

type CookieChangeDetail = { key: string; value: string };

/**
 * Cookie-backed state with cross-component broadcasting. When one consumer
 * writes, every other consumer for the same key sees the update via a
 * window CustomEvent. Without this, two components reading the same cookie
 * (e.g. navbar region selector + search dialog region picker) drift apart
 * because each holds its own useState copy.
 */
export function useCookie(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(defaultValue);

  useEffect(() => {
    const stored = Cookies.get(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from cookie after mount to avoid SSR mismatch
    if (stored) setValue(stored);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CookieChangeDetail>).detail;
      if (detail?.key === key) setValue(detail.value);
    };
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, [key]);

  const update = useCallback(
    (next: string) => {
      Cookies.set(key, next, { expires: ONE_YEAR_DAYS, sameSite: "lax" });
      setValue(next);
      window.dispatchEvent(
        new CustomEvent<CookieChangeDetail>(CHANGE_EVENT, {
          detail: { key, value: next },
        }),
      );
    },
    [key],
  );

  return [value, update];
}
