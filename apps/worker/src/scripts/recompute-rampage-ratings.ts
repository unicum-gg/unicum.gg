// Rewrite the cached Rampage ratings with the current formula.
//
//   pnpm --filter @unicum.gg/worker recompute-rampage-ratings [eu|na|asia]
//
// Run ONCE, right after the deploy that renamed the Steel Hunter board to
// Rampage and replaced HR with MR. The mode ended in May 2016, so no account's
// figures move again and the snapshot path has no reason to revisit the row,
// which is what makes this a one-shot rather than something that converges on
// its own. Idempotent: it writes only the rows whose value actually changes, so
// re-running it is a no-op.
import { regionArgs } from "./args";
import { recomputeRampageRatings } from "@unicum.gg/core/players/mode-ratings";

async function main(): Promise<void> {
  for (const region of regionArgs()) {
    const at = Date.now();
    const written = await recomputeRampageRatings(region);
    console.log(
      `[recompute-rampage-ratings-${region}] ${written} rewritten in ` +
        `${((Date.now() - at) / 1000).toFixed(1)}s`,
    );
  }
}

void main().then(() => process.exit(0));
