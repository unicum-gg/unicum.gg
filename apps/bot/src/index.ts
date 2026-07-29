// Standalone Discord bot (dixt). It is a pure client of unicum.gg's own public
// API through `@unicum.gg/sdk` (command data + autocomplete via the streamed
// search) — no direct DB access — so `/player` and `/clan` surface the ratings
// and deltas the aggregator bots don't have, and every reply links back to the
// player's unicum.gg page. Deployed as its own service.
import { GatewayIntentBits } from "discord.js";

async function main(): Promise<void> {
  const { env } = await import("./env.js");
  const { APP_IDENTITY } = await import("@unicum.gg/shared/app-identity");
  const { default: dixt, dixtDefaults } = await import("dixt");
  const { default: wotPlugin } = await import("./plugins/wot/index.js");
  const { default: presencePlugin } = await import("dixt-plugin-presence");
  const { presences, bindPresenceClient } = await import("./presence.js");

  // dixt defaults to EVERY gateway intent, including the privileged ones the app
  // hasn't enabled ("Used disallowed intents"). A slash-command bot only needs
  // `Guilds`. dixt deep-merges config with lodash (arrays merge by index, so a
  // shorter `clientOptions.intents` in the config below can't override it), so
  // we replace the default at its source instead.
  dixtDefaults.clientOptions = { intents: [GatewayIntentBits.Guilds] };

  const bot = new dixt({
    application: {
      id: env.DIXT_APPLICATION_ID,
      name: env.DIXT_APPLICATION_NAME ?? APP_IDENTITY.NAME,
      bot: { token: env.DIXT_BOT_TOKEN },
    },
    // Register explicitly rather than via auto-discovery: dixt discovers
    // `dixt-plugin-*` deps and loads their options through a CJS `require` of
    // `src/options/<name>.ts`. This bot is ESM (tsx), so that would load a second
    // copy of `presence.ts` in a separate module graph (breaking the client
    // binding the server-count line needs) on top of the auto-loaded default
    // presence. Manual registration keeps a single ESM graph and no double-load.
    autoDiscoverPlugins: false,
    plugins: [
      wotPlugin,
      // Rotating status: live totals + server count + a /help hint (see presence.ts).
      [presencePlugin, { interval: 30, presences }],
    ],
  });

  // Give the presence entries access to the client for the server-count line.
  bindPresenceClient(bot.client);

  await bot.start();
  console.log(`[bot] ${APP_IDENTITY.NAME} Discord bot running`);
}

main().catch((err) => {
  console.error("[bot] fatal boot error:", err);
  process.exit(1);
});
