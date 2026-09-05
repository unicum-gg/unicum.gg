"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The alternate minimap art of a map's random events, drawn over the standard
 * minimap: the danger areas the game marks before an event, or the ground it
 * redraws once the event has struck.
 *
 * Each layer is a full-size image, transparent everywhere but the patch it
 * covers, so they stack straight onto the minimap with no positioning. A layer
 * the mirror has not published yet 404s and is dropped rather than leaving a
 * broken image over the map.
 */
export function MinimapLayers({ urls }: { urls: string[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  return (
    <>
      {urls
        .filter((url) => !failed.includes(url))
        .map((url) => (
          <Image
            key={url}
            src={url}
            // Decorative: they stack over a minimap that already carries the
            // map's name, and one sentence per layer would be read out two to
            // four times over a single image.
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 640px"
            onError={() => setFailed((f) => [...f, url])}
            className="pointer-events-none object-cover"
          />
        ))}
    </>
  );
}
