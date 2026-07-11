"use client";

import Image from "next/image";
import { useState } from "react";

// High-resolution tankopedia render (1920x900) served from WG's portal CDN,
// keyed by the vehicle tag. Falls back to the lower-res encyclopedia render if
// the portal one is missing. Rendered `fill` so it sizes to the hero.
export function TankRender({
  tag,
  fallback,
  name,
}: {
  tag: string;
  fallback: string | null;
  name: string;
}) {
  const slug = tag.toLowerCase();
  const primary = `https://eu-wotp.wgcdn.co/dcont/tankopedia_images/${slug}/${slug}_image.png`;
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
