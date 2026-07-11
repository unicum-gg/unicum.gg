"use client";

import Image from "next/image";
import { useState } from "react";
import { Region } from "@unicum.gg/wargaming/region";
import { tankopediaImageUrl } from "@unicum.gg/wargaming/cdn";

// High-resolution tankopedia render (1920x900) served from WG's portal CDN,
// keyed by the vehicle tag. Falls back to the lower-res encyclopedia render if
// the portal one is missing. Rendered `fill` so it sizes to the hero.
export function TankRender({
  tag,
  region,
  fallback,
  name,
}: {
  tag: string;
  region: Region;
  fallback: string | null;
  name: string;
}) {
  const primary = tankopediaImageUrl(region, tag);
  const [failed, setFailed] = useState(false);
  const src = failed ? (fallback ? fallback.replace(/^http:/, "https:") : "") : primary;
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={name}
      fill
      priority
      sizes="100vw"
      onError={() => setFailed(true)}
      className="object-cover object-center drop-shadow-2xl"
    />
  );
}
