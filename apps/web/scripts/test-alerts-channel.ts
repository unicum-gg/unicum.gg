// One-shot: prove the bot can actually post to DISCORD_ALERTS_CHANNEL_ID.
// Worth running once after wiring the channel, since a watchdog that cannot
// reach its channel is indistinguishable from one with nothing to report.
//   pnpm --filter @unicum.gg/web exec tsx --env-file=.env.local scripts/test-alerts-channel.ts
import { env } from "@unicum.gg/shared";
import { postChannelMessage } from "@unicum.gg/core/discord";

async function main() {
  const channel = env.DISCORD_ALERTS_CHANNEL_ID;
  if (!channel) {
    console.error("DISCORD_ALERTS_CHANNEL_ID is not set");
    process.exit(1);
  }
  const ok = await postChannelMessage(
    channel,
    "🩺 Onslaught capture watchdog wired up. This channel receives a message when the capture stalls for an hour, and another when it recovers. Nothing else.",
  );
  console.log(ok ? "posted" : "REFUSED (bot missing from the server, or no access to that channel)");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
