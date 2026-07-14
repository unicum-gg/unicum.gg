"use client";

import Image from "next/image";
import { useState } from "react";
import { Region, defaultVehicleRenderUrl, tankopediaImageUrl } from "@unicum.gg/wargaming";

// High-resolution tankopedia render (1920x900) served from WG's portal CDN,
// keyed by the vehicle tag. Falls back to the lower-res encyclopedia render,
// then to WG's "vehicle under a tarp" placeholder, so the hero always shows
// something. Rendered `fill` so it sizes to the hero.
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
  // Ordered by preference: hi-res portal render, the encyclopedia render, then
  // WG's covered-vehicle placeholder (always published). We advance on the first
  // image error and stop at the placeholder.
  const candidates = [
    tankopediaImageUrl(region, tag),
    fallback,
    defaultVehicleRenderUrl(region),
  ].filter((u): u is string => Boolean(u));
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];
  return (
    <Image
      key={src}
      src={src}
      alt={name}
      fill
      priority
      sizes="100vw"
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
      className="object-cover object-center drop-shadow-2xl"
    />
  );
}
