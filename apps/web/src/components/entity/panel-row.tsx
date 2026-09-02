/**
 * The line boxes every profile panel's list is built from.
 *
 * Extracted because `VehicleRow` already carries the warning: its own doc says
 * these classes were copied between the lift/drag columns and the marks panel
 * until it existed, and a spacing change to one left the other misaligned
 * inside the same panel stack. A panel listing players rather than vehicles
 * needs the same boxes and none of the tank markup, so the boxes are what is
 * shared.
 */
export const PANEL_ROW_CLASS =
  "flex items-center gap-3 border-b border-fd-border/40 px-4 py-2 last:border-fd-border";

/** The leading slot: a tank icon, a rank, anything fixed-width. */
export const PANEL_ROW_ICON_CELL_CLASS =
  "flex w-10 shrink-0 items-center justify-center";

/** The right-hand pair: a value with a line under it saying what it means. */
export const PANEL_ROW_VALUE_CELL_CLASS =
  "flex flex-col items-end gap-0.5 tabular-nums";
