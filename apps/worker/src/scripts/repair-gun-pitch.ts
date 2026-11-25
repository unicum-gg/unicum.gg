// Undo what the swapped gun pitch reading did to the tank history.
//
//   pnpm --filter @unicum.gg/worker repair-gun-pitch          # dry run
//   pnpm --filter @unicum.gg/worker repair-gun-pitch --apply
//
// See `repairGunPitch` for what went wrong and what this writes.
import { repairGunPitch } from "@unicum.gg/core/wargaming/wot/tanks/spec-history-pitch-repair";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { snapshots, relabelled, dropped, kept } = await repairGunPitch({ apply });
  console.log(
    `repair-gun-pitch: ${snapshots} snapshot(s), ${relabelled} relabelled, ${dropped} dropped, ${kept} kept${apply ? " written" : " (dry run, pass --apply to write)"}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("repair-gun-pitch failed:", error);
    process.exit(1);
  });
