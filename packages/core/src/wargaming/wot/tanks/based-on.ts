import fs from "node:fs/promises";
import path from "node:path";
import {
  modelUrl,
  modelsRefFor,
  type Region,
  type WotSrcBranch,
} from "@unicum.gg/wargaming";
import { getTankDataset } from "./dataset";
import { cachedInRedis } from "../../../redis";

// The mirror is rebuilt on a game patch like the rest of the client data, so a
// day is the right life for this. Two lines of JSON for the whole catalogue.
const TTL_SECONDS = 24 * 60 * 60;

// **An empty answer is not worth a day.** The mirror is a repository like any
// other and a read of it can come back with nothing, from a branch that has not
// been pushed or a blip at the far end. Kept for a day, that nothing becomes the
// answer for every tank until tomorrow.
const EMPTY_TTL_SECONDS = 5 * 60;

/** The vehicle a tank was made from, as the page names it. */
export type BasedOn = {
  name: string;
  slug: string;
};

/**
 * Which vehicle each one was made from, by client code.
 *
 * The mirror works this out from the game client and can only say it in the
 * client's own codes: it has never heard of the catalogue a site routes by.
 * Resolving those to a tank is this side's job.
 */
function origins(branch?: WotSrcBranch): Promise<Record<string, string>> {
  const ref = modelsRefFor(branch);
  return cachedInRedis(
    `models:based-on${ref ? `:${ref}` : ""}`,
    (from) => (Object.keys(from).length > 0 ? TTL_SECONDS : EMPTY_TTL_SECONDS),
    async () => {
      // A checkout of the mirror on disk, for working on it before it is
      // pushed. The front has the same escape hatch in
      // `NEXT_PUBLIC_MODELS_ROOT`, which is a site path and so no use to a
      // server: this one is a directory.
      const local = process.env.MODELS_ROOT;
      if (local) {
        const at = path.join(local, "based-on.json");
        return JSON.parse(await fs.readFile(at, "utf8")) as Record<
          string,
          string
        >;
      }
      const response = await fetch(modelUrl("based-on.json", ref));
      if (!response.ok) return {};
      return (await response.json()) as Record<string, string>;
    },
  );
}

/**
 * The tank this one was made from, or null where it stands on its own.
 *
 * **Two ways the client says it, one thing to a reader.** A vehicle can draw
 * another's meshes outright, which is how a reissue or an event variant is
 * built, or ship meshes of its own and point every hit tester at another
 * vehicle's armour, which is how the Ashbringer is the 60TP Lewandowskiego
 * wearing something else. Either way it is that tank underneath.
 *
 * **Never guessed from the code.** The Charioteer Mk VII is `GB133` and takes
 * its armour from `GB80`; the M4A4 Firefly CFE takes its from a British folder
 * while being American. A prefix rule finds most and quietly mismatches the
 * rest, so the client's own declaration is the only source.
 *
 * Null where the two share a name: WG lists some tanks twice, once for the
 * vehicle and once for a mode-locked copy of it, and telling a reader the T-34
 * is based on the T-34 says nothing.
 */
export async function getTankBasedOn(
  region: Region,
  tag: string,
  branch?: WotSrcBranch,
): Promise<BasedOn | null> {
  const from = (await origins(branch))[tag];
  if (!from) return null;
  const dataset = await getTankDataset(region);
  const donor = dataset.find((row) => row.identity.tag === from);
  const self = dataset.find((row) => row.identity.tag === tag);
  if (!donor || donor.identity.name === self?.identity.name) return null;
  return { name: donor.identity.name, slug: donor.identity.slug };
}
