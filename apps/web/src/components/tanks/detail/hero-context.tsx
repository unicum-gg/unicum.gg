"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { HeroSetup } from "@/components/tanks/detail/specifications/config-url";

/**
 * What the hero is showing, so the shared link can say it.
 *
 * **The token belongs to the configurator and the picture does not.** They are
 * siblings on the page: one owns the query string, the other owns the vehicle,
 * and neither is inside the other. A reader who poses the tank hull down in the
 * armour view, dresses it and paints three marks on the gun has described
 * something worth sending, and without this the link they copy says only which
 * gun was fitted.
 *
 * Reported wholesale rather than field by field: the hero knows its own state
 * and the configurator has no business knowing which parts of it exist.
 */
type Shown = {
  hero: HeroSetup;
  show: (next: HeroSetup) => void;
};

const HeroShown = createContext<Shown>({ hero: {}, show: () => {} });

/** Whether two states say the same thing, so publishing settles. */
function same(a: HeroSetup, b: HeroSetup): boolean {
  return (
    a.view === b.view &&
    a.cut === b.cut &&
    a.paint === b.paint &&
    a.season === b.season &&
    a.marks === b.marks &&
    a.hullDown === b.hullDown &&
    a.shot?.pen === b.shot?.pen &&
    a.shot?.caliber === b.shot?.caliber &&
    a.shot?.norm === b.shot?.norm &&
    a.shot?.ricochet === b.shot?.ricochet &&
    a.shot?.kind === b.shot?.kind &&
    a.aim?.bearing === b.aim?.bearing &&
    a.aim?.pitch === b.aim?.pitch
  );
}

export function HeroShownProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hero, setHero] = useState<HeroSetup>({});
  // The hero publishes what it is showing on every change, including the ones
  // that changed nothing, so this settles rather than answering itself.
  const show = useCallback((next: HeroSetup) => {
    setHero((held) => (same(held, next) ? held : next));
  }, []);
  const value = useMemo(() => ({ hero, show }), [hero, show]);
  return <HeroShown.Provider value={value}>{children}</HeroShown.Provider>;
}

/**
 * What the hero is showing, where the page provides a channel for it.
 *
 * Outside a provider it is inert rather than an error: the comparison page runs
 * four configurators with no hero above them.
 */
export function useHeroShown(): Shown {
  return useContext(HeroShown);
}
