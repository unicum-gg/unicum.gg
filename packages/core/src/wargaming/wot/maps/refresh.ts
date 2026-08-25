import { buildMapSnapshotData, type MapSnapshotData } from "@unicum.gg/shared";
import {
  BRANCH_BY_REGION,
  compareBuildVersions,
  Region,
  WotSrcBranch,
  type WotSrcArena,
} from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { resolveArenaNames } from "./catalog";
import { recordMapChanges } from "./history";
import { clearMapTestChanges, recordMapTestChanges } from "./test-changes";

/**
 * The game version a client build belongs to: `2.3.1.5412` -> `2.3.1`.
 *
 * The three-part form is what Wargaming calls an update and what the backfill
 * reads out of the mirror's commit subjects, so both halves of the history key
 * their snapshots the same way.
 */
function gameVersionOf(build: string): string {
  return build.split(".").slice(0, 3).join(".");
}

async function catalogFor(branch: WotSrcBranch): Promise<WotSrcArena[]> {
  const arenas = await wg.region(Region.EU).source.arenas.catalog(branch);
  resolveArenaNames(arenas);
  return arenas;
}

const snapshotsOf = (arenas: WotSrcArena[]): Map<string, MapSnapshotData> =>
  new Map(arenas.map((a) => [a.arenaId, buildMapSnapshotData(a)]));

export type MapRefreshResult = {
  version: string | null;
  changes: number;
  testVersion: string | null;
  testChanges: number;
};

/**
 * Record what this client build changed about the game's maps, and what the
 * Common Test build is about to change.
 *
 * The forward half of the map history, run daily by the vehicles cron. Maps are
 * region-agnostic (Wargaming ships the same ones everywhere), so this reads the
 * EU branch once.
 *
 * The version is taken from the mirror's own build stamp rather than from
 * Wargaming's API on purpose: the two are not in step (the mirror is rebuilt
 * hours after an update goes live), and stamping freshly-published data with a
 * version whose scripts we have not read yet would freeze a wrong baseline for
 * that update, which the immutable per-version snapshot then makes permanent.
 * Reading both the data and its version from the same build cannot drift: a run
 * before the mirror catches up simply re-records the version it already has, and
 * is inert.
 */
export async function refreshMapHistory(): Promise<MapRefreshResult> {
  const specs = wg.region(Region.EU).source.specs;
  const [liveArenas, testArenas, liveBuild, testBuild] = await Promise.all([
    catalogFor(BRANCH_BY_REGION[Region.EU]),
    // No test running, or a branch that cannot be read, simply leaves the live
    // history alone.
    catalogFor(WotSrcBranch.CT).catch(() => [] as WotSrcArena[]),
    specs.branchVersion(BRANCH_BY_REGION[Region.EU]).catch(() => null),
    specs.branchVersion(WotSrcBranch.CT).catch(() => null),
  ]);

  const result: MapRefreshResult = {
    version: null,
    changes: 0,
    testVersion: null,
    testChanges: 0,
  };

  const live = snapshotsOf(liveArenas);
  if (liveBuild && liveArenas.length > 0) {
    const version = gameVersionOf(liveBuild);
    const recorded = await recordMapChanges(liveArenas, version);
    result.version = version;
    result.changes = recorded.changes;
  }

  // A test branch is only a test build while it is ahead of the live one: the
  // mirror's CT branch is left sitting on a finished test between events, and
  // read blindly that would report what the last update shipped as pending, with
  // live and test the wrong way round.
  //
  // Both builds have to be readable to say anything: a failed read of the LIVE
  // version tells us nothing about the test, and treating it as "not ahead"
  // would throw away a real pending diff on a transient error.
  const comparable = liveBuild !== null && testBuild !== null && testArenas.length > 0;
  const testIsAhead = comparable && compareBuildVersions(testBuild, liveBuild) > 0;

  if (testIsAhead && testBuild) {
    result.testVersion = testBuild;
    result.testChanges = await recordMapTestChanges(
      live,
      snapshotsOf(testArenas),
      testBuild,
    );
  } else if (comparable) {
    // Both builds read, and the test one is not ahead: whatever it used to say
    // was coming has shipped or was never real. Anything less certain leaves the
    // table as it was.
    await clearMapTestChanges();
  }

  return result;
}
