"use client";

import type { Region } from "@unicum.gg/wargaming";

import { useBuildLink } from "@/components/tanks/detail/build-context";
import { CompareWithTank } from "@/components/tanks/detail/specifications/compare-with-tank";

/**
 * Put this vehicle up against another, from the corner of the hero.
 *
 * The same control the characteristics carry, offered where a reader is already
 * looking at the tank rather than only once they have scrolled to its numbers.
 * It takes the build from the configurator below, so a comparison opened from
 * up here arrives on the modules on screen and not on the ones the tank was
 * sold with.
 */
export function HeroCompare({
  region,
  slug,
}: {
  region: Region;
  slug: string;
}) {
  const { portable } = useBuildLink();
  return (
    <CompareWithTank
      region={region}
      slug={slug}
      setupToken={portable}
      // The hero's own chrome rather than the characteristics': its buttons are
      // padded to their icon where those are a fixed square, and a pair that
      // does not match is two buttons rather than one control beside another.
      triggerClassName="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-none aria-expanded:bg-fd-secondary aria-expanded:text-fd-foreground"
    />
  );
}
