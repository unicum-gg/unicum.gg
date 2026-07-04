"use client";

import Image from "next/image";
import { useState } from "react";
import type { Region } from "@unicum.gg/wargaming/region";
import {
  defaultTankIconUrl,
  tankIconUrl,
} from "@unicum.gg/wargaming/cdn";

export function TankIcon({
  region,
  tag,
  type,
  className,
}: {
  region: Region;
  tag: string;
  type: string;
  className?: string;
}) {
  const primary = tankIconUrl(region, tag);
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
