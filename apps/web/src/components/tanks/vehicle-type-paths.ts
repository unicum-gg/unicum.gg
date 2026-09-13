/**
 * The glyph each vehicle class is drawn as, and the size of the box it is drawn
 * in.
 *
 * Deliberately NOT in `vehicle-type-icon.tsx` beside the component that renders
 * it: that file is a client component, and a `"use client"` module exports
 * client REFERENCES rather than values. A server module that imports one of its
 * consts is handed a function, and reading a key off it answers undefined. The
 * OG cards are rendered by a route handler and drew no vehicle glyph at all for
 * exactly that reason, silently, since the component reads `if (!spec) return
 * null` and a missing icon looks like a design decision.
 */
export type IconSpec = {
  width: number;
  height: number;
  d: string | string[];
};

export const VEHICLE_TYPE_PATHS: Record<string, IconSpec> = {
  lightTank: {
    width: 11,
    height: 13,
    d: "M5.5 0L0 6.5 5.5 13 11 6.5z",
  },
  mediumTank: {
    width: 12,
    height: 15,
    d: "M12 7.5L9.7 4.7l-6 7.5L6 15zM6 0L0 7.5l2.3 2.8 6-7.5z",
  },
  heavyTank: {
    width: 15,
    height: 18,
    d: [
      "M13.2 6.8l-7.5 9.1L7.5 18 15 9z",
      "M10.3 3.4l-7.4 9.1 1.8 2.1 7.4-9z",
      "M7.5 0L0 9l1.9 2.2 7.4-9z",
    ],
  },
  "AT-SPG": {
    width: 12,
    height: 10,
    d: "M0 0l6 10 6-10z",
  },
  SPG: {
    width: 8,
    height: 8,
    d: "M0 0h8v8H0z",
  },
};
