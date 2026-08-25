"use client";

import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr";
import { lowResMinimapUrl, minimapUrl } from "@unicum.gg/shared";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Minimap render with a graceful fallback: a handful of arenas (event-only
// variants) have no HD PNG on the wot.maps mirror, so a 404 drops to the
// client's own low-res GUI icon, then to a neutral placeholder instead of a
// broken image. The chain is derived from `arenaId` here rather than passed in,
// so no caller can wire a fallback that resolves to the same URL as `src` (which
// is how the changes feed ended up showing the placeholder for maps that do have
// an icon). `src` changes reset the error state on their own (a new URL no
// longer matches the failed list), so navigating between maps in a filtered grid
// never sticks on the placeholder.
export function MinimapImage({
  src,
  arenaId,
  alt,
  sizes,
  priority,
  className,
}: {
  /** The minimap to show, usually the arena's HD one but sometimes a mode
   * variant (the Onslaught play area has its own image). */
  src: string;
  /** The arena the minimap belongs to, the fallback chain is built from it. */
  arenaId: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = [
    ...new Set([src, minimapUrl(arenaId), lowResMinimapUrl(arenaId)]),
  ];
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
