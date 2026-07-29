import type { DixtPluginPresenceOptions } from "dixt-plugin-presence";
import { presences } from "../lib/presence.js";

/**
 * Config for the auto-discovered `dixt-plugin-presence` (dixt loads this by
 * convention from `src/options/<plugin>.ts`). The plugin rotates through the
 * entries every `interval` seconds; the entries are dynamic `() => PresenceData`
 * functions backed by live totals (see presence.ts).
 */
const options: DixtPluginPresenceOptions = {
  interval: 30,
  presences,
};

export default options;
