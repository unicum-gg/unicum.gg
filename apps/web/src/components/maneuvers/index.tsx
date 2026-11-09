import { ManeuversView } from "./view";
import { buildSafe, unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

/** Rows fetched for each board. */
const LIMIT = 100;

/**
 * The prerendered (ISR) render of the Maneuvers boards.
 *
 * Both boards are fetched in the one call that serves them, so the standings a
 * reader compares were recomputed at the same instant; splitting them would let
 * a cutoff from one pass sit beside a ranking from the next.
 *
 * `buildSafe` lets a DB-less prerender emit an empty shell that heals on its
 * first revalidation, like the other ISR boards.
 */
export async function ManeuversPage({ region }: { region: Region }) {
  const board = await buildSafe(
    () => unicum.region(region).maneuvers(LIMIT),
    { edition: null, standing: null, players: [], clans: [] },
  );

  return <ManeuversView region={region} board={board} />;
}
