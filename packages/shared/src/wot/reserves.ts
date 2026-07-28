import { iconUrl } from "./assets";

// WG's own reserve icon CDN is dead, so we serve the client's "order" icons
// from the wot.assets mirror. The client icon key is the reserve type
// snake→camel, except two the client names differently (kept as overrides so
// the rest stays derived, not a maintained map).
const RESERVE_ICON_OVERRIDE: Record<string, string> = {
  BATTLE_PAYMENTS: "combatPayments",
  MILITARY_MANEUVERS: "militaryExercises",
};

/** Mirror URL for a Stronghold reserve ("order") icon, keyed by WG reserve type. */
export function reserveIconUrl(type: string): string {
  const key =
    RESERVE_ICON_OVERRIDE[type] ??
    type.toLowerCase().replace(/_(.)/g, (_, c) => c.toUpperCase());
  return iconUrl(`orders/big/${key}.png`);
}
