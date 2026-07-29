import { ActivityType, type Client, type PresenceData } from "discord.js";
import { APP_IDENTITY } from "@unicum.gg/shared/app-identity";
import { REGIONS } from "@unicum.gg/wargaming";
import { unicum } from "./plugins/wot/lib/sdk.js";

// Rotation itself is handled by `dixt-plugin-presence`; this module only feeds it
// dynamic `() => PresenceData` entries backed by live totals. Discord renders a
// bot's activity name + type only (no images/details/buttons — that is user-only
// Rich Presence), so a rotating live total is the richest presence a bot can show.

// The coverage endpoint caches 60s, so refreshing the totals every few minutes is
// gentle; the plugin's rotation runs on a shorter beat.
const REFRESH_MS = 5 * 60_000;

type Totals = { players: number; clans: number; battles: number };

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

let totals: Totals | null = null;
let lastFetch = 0;
let inFlight = false;

// The plugin calls the presence entries with no args, so the server-count line
// needs the client captured here. Bound at boot; the guild cache is populated by
// the time the plugin's first rotation tick fires (well after ready).
let client: Client | null = null;
export function bindPresenceClient(c: Client): void {
  client = c;
}

async function refreshTotals(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const perRegion = await Promise.all(
      REGIONS.map((r) => unicum.region(r).coverage()),
    );
    totals = perRegion.reduce<Totals>(
      (acc, c) => ({
        players: acc.players + c.players,
        clans: acc.clans + c.clans,
        battles: acc.battles + c.funFacts.totalBattlesTracked,
      }),
      { players: 0, clans: 0, battles: 0 },
    );
    lastFetch = Date.now();
  } catch (err) {
    console.error("[bot] presence: coverage fetch failed:", err);
  } finally {
    inFlight = false;
  }
}

function watching(name: string): PresenceData {
  return { status: "online", activities: [{ name, type: ActivityType.Watching }] };
}

// A dynamic entry: refreshes the totals in the background when stale, then renders
// the current numbers (plain branding until the first fetch lands). A failed
// fetch keeps the last totals, so the status never blanks out on a WG/API blip.
function line(pick: (t: Totals) => string): () => PresenceData {
  return () => {
    if (Date.now() - lastFetch > REFRESH_MS) void refreshTotals();
    return watching(totals ? pick(totals) : APP_IDENTITY.NAME);
  };
}

/** Rotating presence entries for `dixt-plugin-presence`. */
export const presences: (() => PresenceData)[] = [
  line((t) => `${compact.format(t.players)} players tracked`),
  line((t) => `${compact.format(t.clans)} clans tracked`),
  line((t) => `${compact.format(t.battles)} battles tracked`),
  () => {
    const n = client?.guilds.cache.size ?? 0;
    return watching(`${compact.format(n)} server${n === 1 ? "" : "s"}`);
  },
  () => ({
    status: "online",
    activities: [{ name: "/help for commands", type: ActivityType.Playing }],
  }),
];

// Warm the totals at boot so the first rotation already shows real numbers.
void refreshTotals();
