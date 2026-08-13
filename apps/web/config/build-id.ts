// Stable build identifier across container restarts of the same git revision.
// Used by both `generateBuildId` (asset path namespace) and `deploymentId`
// (Next.js version-skew protection). Same revision → same id → Cloudflare
// can cache static assets safely across rolling deploys; client prefetches
// from an old deploy that hit a new server get a 404 + auto-recover via the
// x-deployment-id mismatch handling.
import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function gitRevision(): string | undefined {
  if (process.env.DEPLOYMENT_ID) return process.env.DEPLOYMENT_ID;
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const revision = gitRevision();

/** Empty when there is neither an env override nor a git checkout to read, in
 * which case Next falls back to its own random build id. */
export const buildId: Pick<NextConfig, "generateBuildId" | "deploymentId"> =
  revision
    ? { generateBuildId: async () => revision, deploymentId: revision }
    : {};
