"use client";

import { useCallback, useState } from "react";
import { TankViewer } from "@/components/tanks/detail/viewer";

/**
 * The render and the model, one giving way to the other.
 *
 * They are held together here rather than side by side in the hero because the
 * swap is a client concern and the hero is not: the picture is the page's first
 * paint and has to stay until there is something better to show, and for a
 * vehicle the geometry mirror does not carry there never is.
 */
export function TankStage({
  code,
  backdrop,
  children,
}: {
  code: string;
  /** WG's hangar photograph, which the model replaces rather than stands on. */
  backdrop: React.ReactNode;
  children: React.ReactNode;
}) {
  const [drawn, setDrawn] = useState(false);
  const ready = useCallback(() => setDrawn(true), []);
  // **The photograph goes with the render it was shot for.** It is a hangar
  // floor seen from high up, and a model drawn at eye level on top of it reads
  // as pasted on rather than standing there: two perspectives, one picture. The
  // model brings its own room, so the plate underneath is left dark and the
  // spotlight above it does the rest.
  const fade = drawn ? "opacity-0" : "opacity-100";
  return (
    <>
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${fade}`}>
        {backdrop}
      </div>
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${fade}`}>
        {children}
      </div>
      <div className="absolute inset-0">
        <TankViewer code={code} onReady={ready} />
      </div>
    </>
  );
}
