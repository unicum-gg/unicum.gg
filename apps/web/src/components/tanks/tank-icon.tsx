"use client";

import Image from "next/image";
import { useState } from "react";
import {
  type Region,
  defaultTankIconUrl,
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
  /** Needed only to key the mirror icon of an unreleased vehicle. */
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
  const fallback = defaultTankIconUrl(region, type);
  // Track which `primary` URL we last got an error for. When the row's
  // identity changes (sort / filter / different tank), `primary` changes and
  // `failedFor` no longer matches, so we automatically go back to the new
  // primary — no effect-driven reset needed.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const src = failedFor === primary ? fallback : primary;

  return (
    <Image
      src={src}
      alt=""
      width={28}
      height={14}
      onError={() => setFailedFor(primary)}
      className={className}
    />
  );
}
