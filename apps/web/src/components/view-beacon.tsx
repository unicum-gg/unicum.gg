"use client";

import { useEffect } from "react";

export function ViewBeacon({ url }: { url: string }) {
  useEffect(() => {
    fetch(url, { method: "POST" }).catch(() => {});
  }, [url]);
  return null;
}
