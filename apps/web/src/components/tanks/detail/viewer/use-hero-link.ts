"use client";

import { useEffect, useMemo, useState } from "react";

import {
  MODULE_SLOTS,
  SETUP_PARAM,
  decodeSetup,
} from "@/components/tanks/detail/specifications/config-url";
import { useHeroShown } from "@/components/tanks/detail/hero-context";
import type { useHeroDress } from "@/components/tanks/detail/viewer/use-hero-dress";
import type { useHeroShot } from "@/components/tanks/detail/viewer/use-hero-shot";
import { View } from "@/components/tanks/detail/viewer/views";
import { useSearchParams } from "next/navigation";

// The shared link, read and written.
//
// **One token, both ways.** The configurator writes the build into the URL and
// the hero writes what it is showing into the same place, so a link is one
// string describing a whole page. Reading it and publishing to it are two ends
// of the same thing, and the reason the read happens once is that the write
// happens constantly.

/** What the link asks the picture for: a build, and a state to open on. */
export function useHeroLink(
  builds?: {
    modules: Record<string, number | null>;
    keys: Record<string, string>;
  }[],
) {
  /**
   * The build the configurator is showing, as the game names its modules.
   *
   * Read from the same URL the configurator writes, so the two stay together
   * with no wiring between them. A token that names a module this vehicle has
   * no build for simply matches nothing and the stock loadout is drawn, which
   * is what a stale share link should do.
   */
  const setup = useSearchParams().get(SETUP_PARAM);
  /**
   * Which pieces the link asks for, as one string.
   *
   * **A string, because the scene is rebuilt whenever this changes.** The
   * configurator writes the whole hero state back into the same token, so this
   * memo re-runs when a reader paints a mark or drags the aim dial, and an
   * object rebuilt from the same three names is still a new object to a
   * dependency array. Measured against a control that should feel instant, that
   * was a new renderer, a re-fetch of the collision shells and every mesh and
   * texture the vehicle has.
   */
  const fittedKey = useMemo(() => {
    if (!setup || !builds?.length) return null;
    const picked = decodeSetup(setup).modules;
    if (!picked) return null;
    const wanted = new Map(
      MODULE_SLOTS.map((slot, i) => [slot, picked[i] ?? null] as const).filter(
        ([, id]) => id !== null,
      ),
    );
    if (wanted.size === 0) return null;
    const build = builds.find((b) =>
      [...wanted].every(([slot, id]) => b.modules[slot] === id),
    );
    // A payload from before the keys existed, or one a cache is still holding,
    // leaves the vehicle at its stock loadout rather than taking the viewer
    // down with it.
    if (!build?.keys) return null;
    return JSON.stringify([
      build.keys.gun,
      build.keys.turret,
      build.keys.chassis,
    ]);
  }, [setup, builds]);
  const fitted = useMemo(() => {
    if (fittedKey === null) return undefined;
    const [gun, turret, chassis] = JSON.parse(fittedKey) as string[];
    return { gun, turret, chassis };
  }, [fittedKey]);
  /**
   * What the reader opened the page on, read once.
   *
   * Once, because the configurator writes the token back into the URL on every
   * edit and this reads from the same place: taken live, the picture would be
   * reset to the link's state by its own publication a moment later.
   */
  const [opening] = useState(() => decodeSetup(setup).hero ?? {});
  return { fitted, opening };
}

/**
 * What the picture is showing, told to whoever writes the link.
 *
 * **What is being looked at, not how this window is set.** The framing, the
 * size, the drifting camera, the running tracks and the texture set are the
 * reader's own desk and say nothing about the vehicle, so they stay in the
 * viewer. Everything that changes the question the picture answers travels.
 */
export function usePublishedHero({
  view,
  dressing,
  firing,
  hullDown,
  aimed,
}: {
  view: View;
  dressing: ReturnType<typeof useHeroDress>;
  firing: ReturnType<typeof useHeroShot>;
  hullDown: boolean;
  aimed: { bearing: number; pitch: number } | null;
}) {
  const { show: publish } = useHeroShown();
  const { shell, loaded, round } = firing;
  useEffect(() => {
    const on = loaded[round];
    // A shot only travels where it is not the round's own: three figures
    // matching the shell it started from and one that does not is exactly the
    // question a reader built, and a link full of a gun's published numbers
    // says nothing the vehicle does not already say.
    const built =
      shell &&
      on &&
      (shell.penetration !== on.shot.penetration ||
        shell.caliber !== on.shot.caliber ||
        shell.normalisation !== on.shot.normalisation ||
        shell.ricochet !== on.shot.ricochet ||
        shell.kind !== on.shot.kind)
        ? {
            pen: shell.penetration,
            caliber: shell.caliber,
            norm: shell.normalisation,
            ricochet: shell.ricochet,
            kind: shell.kind,
          }
        : undefined;
    publish({
      ...(view !== View.Visual ? { view } : {}),
      ...(dressing.skin ? { cut: dressing.skin } : {}),
      ...(dressing.worn ? { paint: dressing.worn.id } : {}),
      ...(dressing.worn && dressing.season !== "summer"
        ? { season: dressing.season }
        : {}),
      ...(dressing.marks > 0 ? { marks: dressing.marks } : {}),
      ...(hullDown ? { hullDown: true } : {}),
      ...(built ? { shot: built } : {}),
      ...(aimed ? { aim: aimed } : {}),
    });
  }, [
    publish,
    view,
    dressing.skin,
    dressing.worn,
    dressing.season,
    dressing.marks,
    hullDown,
    shell,
    loaded,
    round,
    aimed,
  ]);
}
