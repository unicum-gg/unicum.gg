"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CONTROL } from "@/components/tanks/detail/viewer/control-group";
import { View } from "@/components/tanks/detail/viewer/views";
import {
  NOT_ARMOUR,
  OPTICS,
  OUTCOME,
  RAMP,
} from "@/services/tank-viewer/armour/colours";

const ink = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

/** A colour with what it means beside it. */
function Swatch({ colour, children }: { colour: number; children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-3 shrink-0 rounded-sm"
        style={{ background: ink(colour) }}
      />
      <span>{children}</span>
    </div>
  );
}

/**
 * What the colours on the vehicle mean.
 *
 * **Two scales, because the armour views ask two questions.** Reading the plate
 * gives a span in millimetres, and it is this vehicle's own span rather than a
 * fixed one: a scout and a heavy would otherwise share a scale on which the
 * scout is uniformly green and says nothing. Reading the shot gives a chance,
 * and the two answers that are not a chance keep colours of their own.
 *
 * A screen is on neither: it stops nothing by itself, so it has a scale of its
 * own running from a heavy skirt to a bare one.
 *
 * **Asked for rather than always up.** It is a key, and a key is read once: a
 * reader learns that magenta is an observation device and then wants it gone.
 * Standing open it was five lines and a scale in the corner of the picture, the
 * one panel here that never changes and the largest thing on the scene.
 *
 * Where the mark sits is not its own business: it is one of several things in
 * the band under the picture, and each placing itself is how they came to
 * overlap.
 */
export function ArmourLegend({
  view,
  range,
}: {
  view: View;
  range: [number, number];
}) {
  if (view === View.Visual) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="What the colours mean"
          className={CONTROL}
        >
          <Info className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-3 text-xs">
        <Key view={view} range={range} />
      </PopoverContent>
    </Popover>
  );
}

function Key({ view, range }: { view: View; range: [number, number] }) {
  const reading = view === View.Collision;
  return (
    <>
      <div className="mb-2 font-medium uppercase tracking-wide text-fd-muted-foreground">
        Reading
      </div>
      <div
        className="h-2 rounded-sm"
        style={{
          background: reading
            ? "linear-gradient(to right, hsl(120,100%,50%), hsl(60,100%,50%), hsl(0,100%,50%))"
            : `linear-gradient(to right, ${ink(RAMP.none)}, ${ink(RAMP.even)}, ${ink(RAMP.always)})`,
        }}
      />
      <div className="mt-1 flex justify-between text-fd-muted-foreground">
        {reading ? (
          <>
            <span>{Math.round(range[0])} mm</span>
            <span>{Math.round(range[1])} mm</span>
          </>
        ) : (
          <>
            <span>never gets through</span>
            <span>always does</span>
          </>
        )}
      </div>
      <div className="mt-2 space-y-1 text-fd-muted-foreground">
        {!reading ? (
          <>
            <Swatch colour={OUTCOME.ricochet.colour}>
              {OUTCOME.ricochet.label}
            </Swatch>
            <Swatch colour={OUTCOME.overmatch.colour}>
              {OUTCOME.overmatch.label}
            </Swatch>
          </>
        ) : null}
        <div className="flex items-center gap-2">
          <span
            className="size-3 shrink-0 rounded-sm"
            style={{
              background: "linear-gradient(to right, #00c8ff, #c000ff)",
            }}
          />
          <span>a screen, heavy to bare</span>
        </div>
        <Swatch colour={NOT_ARMOUR}>a module or a track</Swatch>
        <Swatch colour={OPTICS}>an observation device</Swatch>
      </div>
    </>
  );
}
