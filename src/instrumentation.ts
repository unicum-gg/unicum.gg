declare global {
  var __cronStarted: boolean | undefined;
}

// WG returns one current A record per host, but undici still tries to connect
// to stale IPs (likely from prior load-balancer rotations cached somewhere
// in the resolver chain). Pinning the current IPs in /etc/hosts forces every
// outbound TLS connection to the known-good backend and keeps SNI = hostname
// for valid certificates. Update these when WG migrates infrastructure.
const WG_HOST_PINS: Array<[string, string]> = [
  ["api.worldoftanks.com", "92.223.101.116"],
  ["api.worldoftanks.eu", "92.223.24.25"],
  ["api.worldoftanks.asia", "92.223.17.174"],
];

async function pinWgHosts() {
  const fs = await import("node:fs/promises");
  let current: string;
  try {
    current = await fs.readFile("/etc/hosts", "utf8");
  } catch (err) {
    console.warn("[wg-pin] cannot read /etc/hosts:", err);
    return;
  }
  const missing = WG_HOST_PINS.filter(
    ([host]) => !new RegExp(`\\s${host.replace(/\./g, "\\.")}\\b`).test(current),
  );
  if (missing.length === 0) return;
  const append =
    "\n# unicum.gg: pin WG api hosts to known-good IPs\n" +
    missing.map(([host, ip]) => `${ip}\t${host}`).join("\n") +
    "\n";
  try {
    await fs.appendFile("/etc/hosts", append);
    console.log(
      `[wg-pin] added ${missing.map(([h]) => h).join(", ")} to /etc/hosts`,
    );
  } catch (err) {
    console.warn("[wg-pin] cannot write /etc/hosts:", err);
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__cronStarted) return;
  globalThis.__cronStarted = true;

  await pinWgHosts();

  const { getInstanceId } = await import("@/services/cron/lease");
  console.log(`[cron] instance ${getInstanceId()}`);

  const { startSnapshotCron } = await import("@/services/snapshots/cron");
  startSnapshotCron();

  const { startClanRefreshCron } = await import("@/services/clans/cron");
  startClanRefreshCron();

  const { startDiscoveryCron } = await import("@/services/discovery/cron");
  startDiscoveryCron();

  const { startTopClansCron } = await import(
    "@/services/wargaming/wot/clans/top/cron"
  );
  startTopClansCron();

  const { startTopPlayersCron } = await import(
    "@/services/wargaming/wot/players/top/cron"
  );
  startTopPlayersCron();
}
