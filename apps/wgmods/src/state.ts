// What has to survive a restart: the release waiting for a session, and which
// alerts were already sent. On the same volume as the browser profile, since a
// redeploy that kept one and lost the other would either publish twice or
// announce the same dead session on every boot.
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type State = {
  /** A release tag that could not be published yet, retried once logged in. */
  pending?: string;
  /** The last tag that reached the hub, so a repeated webhook is a no-op. */
  published?: string;
  /** Alerts are sent on the edge, never repeated while the condition holds. */
  alerted: { loggedOut?: boolean; expiring?: boolean };
  /**
   * The WG ID security token's expiry as last seen. It did not move on a silent
   * re-login when measured (2026-11-06), which is what caps a session at about
   * fourteen days; if it ever does move without a login, that is worth knowing.
   */
  tokenExpiry?: number;
};

const file = () => path.join(config.dataDir, "state.json");

export function readState(): State {
  try {
    return { alerted: {}, ...JSON.parse(fs.readFileSync(file(), "utf8")) };
  } catch {
    return { alerted: {} };
  }
}

export function writeState(state: State): void {
  const target = file();
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(state, null, 2));
  fs.renameSync(`${target}.tmp`, target);
}

export function updateState(change: (state: State) => void): State {
  const state = readState();
  change(state);
  writeState(state);
  return state;
}
