"use client";

import Image from "next/image";
import { useState } from "react";
import {
  type Region,
  defaultTankIconUrl,
  eventContourIconUrl,
  mirrorContourIconUrl,
  tankIconUrl,
} from "@unicum.gg/wargaming";

export function TankIcon({
  region,
  tag,
  type,
  nation,
  isCommonTest = false,
  className,
}: {
  region: Region;
  tag: string;
  type: string;
  /** Keys the mirror icon of a vehicle WG's CDN has nothing for: an unreleased
   * one, or (tried after the CDN) an event mode's. */
  nation?: string;
  isCommonTest?: boolean;
  className?: string;
}) {
  // WG's CDN only serves released vehicles, so a test one has to come from the
  // client's own icon, which our mirror publishes.
  const primary =
    isCommonTest && nation
      ? mirrorContourIconUrl(nation, tag)
      : tankIconUrl(region, tag);
  const candidates = [
    primary,
    ...(nation && !isCommonTest ? [eventContourIconUrl(nation, tag)] : []),
    defaultTankIconUrl(region, type),
  ];
  // Track which URLs failed. When the row's identity changes (sort / filter /
  // different tank), its URLs no longer match the list, so we automatically go
  // back to the new primary, with no effect-driven reset needed.
  const [failed, setFailed] = useState<string[]>([]);
  const src =
    candidates.find((candidate) => !failed.includes(candidate)) ??
    candidates[candidates.length - 1];

  return (
    <Image
      src={src}
      alt=""
      width={28}
      height={14}
      onError={() => setFailed((list) => [...list, src])}
      className={className}
    />
  );
}
