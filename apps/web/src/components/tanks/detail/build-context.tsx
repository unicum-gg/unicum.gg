"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The build this page is showing, as a link something else can carry.
 *
 * **The other direction of the same wire.** The hero tells the configurator
 * what it is showing so the shared link says it; this brings the configurator's
 * own answer back up, so a control in the hero can take the build somewhere
 * rather than only describe it.
 *
 * It is the *portable* token, the one that spells its modules out. A comparison
 * column opens on the top configuration where a tank page opens on stock, so
 * the short token would land the vehicle on modules the reader never chose.
 */
type Build = {
  portable: string | null;
  publish: (token: string | null) => void;
};

const BuildLink = createContext<Build>({ portable: null, publish: () => {} });

export function BuildLinkProvider({ children }: { children: React.ReactNode }) {
  const [portable, setPortable] = useState<string | null>(null);
  const publish = useCallback((token: string | null) => {
    setPortable((held) => (held === token ? held : token));
  }, []);
  const value = useMemo(() => ({ portable, publish }), [portable, publish]);
  return <BuildLink.Provider value={value}>{children}</BuildLink.Provider>;
}

/**
 * The build's portable link, where the page provides one.
 *
 * Null outside a provider and null before the configurator has rendered, which
 * both mean the same thing to a caller: take the vehicle as it stands.
 */
export function useBuildLink(): Build {
  return useContext(BuildLink);
}
