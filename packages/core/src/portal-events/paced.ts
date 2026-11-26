import { PortalChallengeError } from "@unicum.gg/wargaming";

/**
 * How the captures ask the portal for its pages: one at a time, a few seconds
 * apart, and once more after a pause when handed the bot shield.
 *
 * They asked for every language at once first, about nineteen pages in one
 * burst per tick, and the portal's shield answered a share of them with its
 * "Loading site please wait..." interstitial instead (measured from the worker
 * on 2026-11-26, a different share each tick). The shield judges a burst from
 * one address, and an hourly job has all the time in the world.
 */
const PACE_MS = 3_000;
const CHALLENGE_RETRY_MS = 20_000;

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait between two portal pages. */
export const paced = () => pause(PACE_MS);

/** Read a portal page, asking once more after a pause if the shield answers. */
export async function readPastChallenge<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    if (!(err instanceof PortalChallengeError)) throw err;
    await pause(CHALLENGE_RETRY_MS);
    return read();
  }
}
