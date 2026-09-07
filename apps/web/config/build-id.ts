// The revision this build was made from, used as both `generateBuildId` (the
// asset path namespace) and `deploymentId` (Next.js version-skew protection).
//
// Skew protection is the load-bearing half, and it is why this file may not
// fail quietly. Turbopack gives a module an id derived from its path, so the
// same file keeps the same id across builds, and the client runtime registers
// a module id ONCE: the first chunk to claim it wins, later chunks are
// ignored. A browser holding a page from one build that then loads a chunk
// from another therefore keeps the OLD factory for every module both builds
// share, while the new chunks call it expecting the new one. A module that
// merely GAINED an export reads as broken (`useStatsPeriod is not a function`
// on the player page, 2026-09-07, after four deploys inside seventy minutes),
// and only for the readers who straddled a deploy, which is what makes it
// invisible from a browser that reloaded since.
//
// `deploymentId` closes that: Next stamps `?dpl=<id>` on assets and compares
// the client's id against the server's on every navigation, and a mismatch
// becomes a hard navigation (a full reload onto one consistent build) instead
// of a client-side one that mixes the two.
import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * The revision, from whichever of our build environments is running.
 *
 * `git rev-parse` is the fallback rather than the answer because none of the
 * environments that build for production have a repository to read: Coolify
 * clones the source and drops `.git` before Railpack builds it (Preserve
 * Repository is off), and the CI image build excludes `.git` from the context
 * on purpose. That is how skew protection came to be configured and never
 * once active, for months, with nothing in the build log to say so.
 *
 * `SOURCE_COMMIT` is Coolify's own, and it only reaches the build with
 * "Include Source Commit in Build" enabled on the application (it is withheld
 * by default so a commit does not invalidate the layer cache).
 */
function revision(): string | undefined {
  const fromEnv =
    process.env.DEPLOYMENT_ID ||
    process.env.SOURCE_COMMIT ||
    process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.trim().slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const id = revision();

if (!id && process.env.NODE_ENV === "production") {
  throw new Error(
    "No deployment id: set DEPLOYMENT_ID (or SOURCE_COMMIT/GITHUB_SHA), or " +
      "build from a git checkout. Building without one leaves readers who " +
      "straddle a deploy on a mix of two builds, see config/build-id.ts.",
  );
}

/** Empty in development, where there is only ever one build in play. */
export const buildId: Pick<NextConfig, "generateBuildId" | "deploymentId"> = id
  ? { generateBuildId: async () => id, deploymentId: id }
  : {};
