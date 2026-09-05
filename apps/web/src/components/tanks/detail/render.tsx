"use client";

import Image from "next/image";
import { useState } from "react";
import { Region, defaultVehicleRenderUrl, tankopediaImageUrl } from "@unicum.gg/wargaming";

// High-resolution tankopedia render (1920x900) served from WG's portal CDN,
// keyed by the vehicle tag. Falls back to a normalized crop of our wot.assets
// mirror, then to WG's "vehicle under a tarp" placeholder, so the hero always
// shows a proper-sized image. Rendered `fill` so it sizes to the hero.
export function TankRender({
  tag,
  region,
  slug,
  name,
  // The hero is the page's headline image, so it loads eagerly at full width.
  // A grid of thumbnails wants neither: it passes its own `sizes` so the CDN
  // serves a card-sized file, and drops the priority so the six of them queue
  // behind what the reader is actually looking at.
  priority = true,
  sizes = "100vw",
  className = "object-cover object-center drop-shadow-2xl",
}: {
  tag: string;
  region: Region;
  slug: string;
  name: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  // Ordered by preference, advancing on the first image error:
  //  1. WG's hi-res portal render (best, when published).
  //  2. Our region+slug render route (co-located with the page's og image): a
  //     normalization of the wot.assets 420x307 mirror, the actual vehicle for
  //     tanks WG hasn't published a portal render for (e.g. Terrifiant). It
  //     re-frames the mirror into WG's exact 1920x900 portal layout (centroid
  //     ~38.7%/55.6%, per-tank scale), so it drops in identically to a real
  //     render. 404s (no mirror) fall through.
  //  3. WG's covered-vehicle placeholder (always published).
  // We deliberately skip the encyclopedia `big_icon`: it's a 160x100 thumbnail
  // (fine in the tank list) that stretches into a blurry mess in the full-bleed
  // hero — the very bug this avoids.
  const candidates = [
    tankopediaImageUrl(region, tag),
    `/${region}/tanks/${encodeURIComponent(slug)}/render`,
    defaultVehicleRenderUrl(region),
  ].filter((u): u is string => Boolean(u));
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];
  // Every candidate is now a baked 1920x900 portal-format image (the mirror route
  // re-frames into that same layout), so they all fill their box identically with
  // `object-cover object-center` — no per-tank CSS, no drift.
  return (
    <Image
      key={src}
      src={src}
      alt={name}
      fill
      priority={priority}
      sizes={sizes}
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
      className={className}
    />
  );
}
