// One-off backfill of the tank changes history from the wot-src mirror git log.
// Run with the app env loaded, plus a GitHub token so the version enumeration
// (the only GitHub REST call; the file fetches use the raw CDN) doesn't hit the
// 60/h unauthenticated limit or abuse-detection:
//   set -a; source apps/web/.env.local; set +a
//   export GITHUB_TOKEN=$(gh auth token)
//   pnpm --filter @unicum.gg/web exec tsx scripts/backfill-tank-history.ts --wipe
// Flags: --wipe (clear the tables first), --max=N (only the most recent N
// versions, for a quick trial), --region=eu|na|asia (default eu; tables are
// global so region only picks which mirror branch to read).
import { backfillSpecHistory } from "@unicum.gg/core/wargaming/wot/tanks/spec-history-backfill";
import { isRegion, Region } from "@unicum.gg/wargaming";

const argv = process.argv.slice(2);
const wipe = argv.includes("--wipe");
const maxArg = argv.find((a) => a.startsWith("--max="));
const maxVersions = maxArg ? Number(maxArg.split("=")[1]) : undefined;
const regionArg = argv.find((a) => a.startsWith("--region="))?.split("=")[1];
const region = regionArg && isRegion(regionArg) ? regionArg : Region.EU;

backfillSpecHistory({
  region,
  wipe,
  maxVersions,
  onProgress: (msg) => console.log(`[backfill] ${msg}`),
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
