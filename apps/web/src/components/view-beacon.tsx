"use client";

import { useEffect } from "react";
import type { Region } from "@unicum.gg/wargaming/region";
import { unicum } from "@/services/sdk";

/** Fire-and-forget: enqueue an on-demand refresh of this clan when the page is
 * viewed. Failures are ignored (a missed refresh is harmless). */
export function ViewBeacon({ region, tag }: { region: Region; tag: string }) {
  useEffect(() => {
    void unicum
      .region(region)
      .clans(tag)
      .enqueue()
      .catch(() => {});
  }, [region, tag]);
  return null;
}
