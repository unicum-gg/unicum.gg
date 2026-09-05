"use client";

import type { Impact } from "@/services/tank-viewer/armour";

/** The colours the armour views paint with, as CSS. */
const ink = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

/**
 * Whether a swatch needs dark text on it.
 *
 * **On the contrast the eye actually gets, not on a weighted average of the
 * channels.** The obvious rule, add the channels up and cut at the middle, put
 * pure green at 149.7 against a threshold of 150 and so asked for white text on
 * it, at a ratio of 1.37 to 1. A third of a unit either way decided whether a
 * badge could be read at all.
 *
 * This is WCAG's relative luminance, and rather than compare it to a number it
 * works out what black and what white would each give and takes the better one.
 * A colour added to the palette later cannot land on the wrong side of a
 * constant nobody remembers choosing.
 */
const readableOn = (colour: number) => {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((colour >> 16) & 255) +
    0.7152 * channel((colour >> 8) & 255) +
    0.0722 * channel(colour & 255);
  const onBlack = (luminance + 0.05) / 0.05;
  const onWhite = 1.05 / (luminance + 0.05);
  return onBlack > onWhite ? "#101010" : "#ffffff";
};

/** How one layer reads, given what the shot made of it. */
function line({ layer }: { layer: Impact["layers"][number] }) {
  if (layer.optic) return "an observation device";
  if (layer.module) return "a module, not armour";
  if (layer.thickness === null) return "no thickness published";
  const at = `${layer.thickness} mm at ${layer.angle.toFixed(0)}°`;
  if (!layer.step) return at;
  if (layer.step.opening) return "an opening, no armour";
  if (layer.step.ricochet) return `${at} · glances off`;
  const extra = layer.step.overmatch ? " · overmatched" : "";
  return `${at}${extra} → ${Math.round(layer.step.effective)} mm`;
}

/** How far from the cursor the panel sits, so it never hides what it describes. */
const GAP = 16;

/** Room the panel needs before it will still fit on the side it prefers. */
const NEEDS = { width: 280, height: 220 };

/**
 * What the readout is saying, and where on the picture to say it.
 *
 * Named because the render loop holds the last one it published: the value is
 * recomputed every time the pointer or the picture moves, and handing React a
 * fresh object that says the same thing re-renders the whole viewer for nothing.
 */
export type Reading = {
  impact: Impact;
  /** Where the cursor is on the picture, in the units the panel is placed in. */
  at: { x: number; y: number };
  size: { width: number; height: number };
};

/**
 * What a shell would do where the cursor is pointing.
 *
 * **It follows the cursor rather than sitting in a corner.** The reading is
 * about one plate, and a panel parked away from that plate makes the reader
 * carry a number across the picture and hope it still applies to what they are
 * looking at. Beside the cursor, the answer and the thing it answers about are
 * the same glance.
 *
 * It flips to the other side near an edge, on the room actually left rather
 * than on which half the cursor is in: a panel that turns over in the middle of
 * a wide hero jumps for no reason the reader can see.
 *
 * **It reads the stack, not the pixel.** A track in front of a hull is two
 * layers and one shot, and the whole point of showing it as a list is that a
 * player can see which of the two stopped them.
 */
export function ArmourReadout({ reading }: { reading: Reading | null }) {
  if (!reading) return null;
  const { impact, at, size } = reading;
  const { odds, effective, layers, colour, label } = impact;
  const flipX = at.x + NEEDS.width > size.width;
  const flipY = at.y + NEEDS.height > size.height;
  const verdict =
    odds === null
      ? label
      : label
        ? `${label} · ${Math.round(odds * 100)}% get through`
        : `${Math.round(odds * 100)}% of shots get through`;
  return (
    <div
      // Above everything else laid on the band. It is not furniture but an
      // answer about the pixel under the cursor, and it comes earlier in the
      // document than the panels it crosses, so at an equal depth they win:
      // the cost panel was printing straight through it.
      className="pointer-events-none absolute z-30 w-64 rounded-lg border border-fd-border/60 bg-fd-background/80 p-3 text-xs backdrop-blur"
      style={{
        left: at.x,
        top: at.y,
        transform: `translate(${flipX ? `calc(-100% - ${GAP}px)` : `${GAP}px`}, ${
          flipY ? `calc(-100% - ${GAP}px)` : `${GAP}px`
        })`,
      }}
    >
      <div className="mb-2 font-medium tracking-wide text-fd-muted-foreground uppercase">
        Impact
      </div>
      <ul className="space-y-1">
        {layers.map((layer, i) => (
          <li
            key={`${layer.part}-${layer.name}-${i}`}
            className="flex justify-between gap-3"
          >
            <span className="truncate text-fd-foreground">
              {layer.name}
              {layer.spaced ? (
                <span className="text-fd-muted-foreground"> screen</span>
              ) : null}
            </span>
            <span className="shrink-0 text-fd-muted-foreground">
              {line({ layer })}
            </span>
          </li>
        ))}
      </ul>
      {effective !== null ? (
        <div className="mt-2 flex justify-between border-t border-fd-border/60 pt-2 text-fd-muted-foreground">
          <span>effective</span>
          <span className="text-fd-foreground">{Math.round(effective)} mm</span>
        </div>
      ) : null}
      {verdict ? (
        <div
          className="mt-2 rounded px-2 py-1 text-center font-medium"
          style={{ background: ink(colour), color: readableOn(colour) }}
        >
          {verdict}
        </div>
      ) : null}
    </div>
  );
}
