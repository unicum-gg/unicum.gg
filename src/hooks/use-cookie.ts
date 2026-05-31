"use client";

import Cookies from "js-cookie";
import { useCallback, useEffect, useState } from "react";

const ONE_YEAR_DAYS = 365;

export function useCookie(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(defaultValue);

  useEffect(() => {
    const stored = Cookies.get(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from cookie after mount to avoid SSR mismatch
    if (stored) setValue(stored);
  }, [key]);

  const update = useCallback(
    (next: string) => {
      Cookies.set(key, next, { expires: ONE_YEAR_DAYS, sameSite: "lax" });
      setValue(next);
    },
    [key],
  );

  return [value, update];
}
