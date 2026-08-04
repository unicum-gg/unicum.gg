"use client";

import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Minimap render with a graceful fallback: a handful of arenas (event-only
// variants) have no PNG on the wot.assets mirror, so a 404 swaps to a neutral
// placeholder instead of a broken image. `src` changes reset the error state on
// their own (a new URL no longer matches `failedFor`), so navigating between
// maps in a filtered grid never sticks on the placeholder.
export function MinimapImage({
  src,
  fallbackSrc,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string;
  /** Low-res minimap tried when `src` 404s (legacy event/arcade maps have no HD
   * asset but ship a client GUI icon). A placeholder shows if both fail. */
  fallbackSrc?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = fallbackSrc ? [src, fallbackSrc] : [src];
  const active = candidates.find((c) => !failed.includes(c));
  if (!active) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-fd-muted text-fd-muted-foreground",
          className,
        )}
      >
        <MapTrifoldIcon className="size-1/4 opacity-40" />
      </div>
    );
  }
  return (
    <Image
      key={active}
      src={active}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed((f) => [...f, active])}
      className={cn("object-cover", className)}
    />
  );
}
