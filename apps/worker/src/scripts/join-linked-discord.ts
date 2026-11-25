// Put every player who linked Discord on our server, for the links made before
// a link did that on its own. Safe to re-run: a member already in is a no-op.
//
//   pnpm --filter @unicum.gg/worker join-linked-discord
//
// Needs BETTER_AUTH_SECRET (the tokens are stored encrypted), so it runs from a
// machine holding the web's environment. See `joinLinkedDiscord`.
import { joinLinkedDiscord } from "@unicum.gg/core/auth";
import { listDiscordLinks } from "@unicum.gg/core/discord/member-identity";

async function main(): Promise<void> {
  const links = await listDiscordLinks();
  let joined = 0;
  for (const { userId, discordUserId } of links) {
    if (await joinLinkedDiscord(userId, discordUserId)) joined += 1;
  }
  console.log(`join-linked-discord: ${joined} of ${links.length} link(s) on the server`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("join-linked-discord failed:", error);
    process.exit(1);
  });
