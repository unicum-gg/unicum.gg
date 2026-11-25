// Give every linked member their `Nickname [EU]` and server role now, rather
// than at the next hourly pass. Run once after the feature is first deployed.
//
//   pnpm --filter @unicum.gg/worker sync-discord-identities
//
// See `@unicum.gg/core/discord/member-identity`.
import {
  isMemberIdentityEnabled,
  syncAllMemberIdentities,
} from "@unicum.gg/core/discord/member-identity";

async function main(): Promise<void> {
  if (!isMemberIdentityEnabled()) {
    throw new Error(
      "DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and the three DISCORD_*_ROLE_ID must be set",
    );
  }
  const n = await syncAllMemberIdentities();
  console.log(`sync-discord-identities: ${n} linked Discord account(s) synced`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("sync-discord-identities failed:", error);
    process.exit(1);
  });
