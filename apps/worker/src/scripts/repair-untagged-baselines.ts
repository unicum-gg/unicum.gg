// Undo what the untagged baselines did to the tank history.
//
//   pnpm --filter @unicum.gg/worker repair-untagged-baselines          # dry run
//   pnpm --filter @unicum.gg/worker repair-untagged-baselines --apply
//
// See `repairUntaggedBaselines` for what went wrong and what this writes.
import { repairUntaggedBaselines } from "@unicum.gg/core/wargaming/wot/tanks/spec-history-repair";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { tanks, changes } = await repairUntaggedBaselines({ apply });
  console.log(
    `repair-untagged-baselines: ${tanks} tank(s), ${changes} change(s)${apply ? " written" : " (dry run, pass --apply to write)"}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("repair-untagged-baselines failed:", error);
    process.exit(1);
  });
