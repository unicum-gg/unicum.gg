// Standalone Discord bot (dixt). Pure client of unicum.gg's own public API via
// @unicum.gg/sdk (command data + autocomplete through the streamed search) — no
// direct DB access — so /player and /clan surface ratings and deltas the
// aggregator bots don't have, and every reply links back to the unicum.gg page.
//
// Run with the dixt CLI (`dixt dev`): plugins are auto-discovered from the
// `dixt-plugin-*` deps and configured via `src/options/*.ts` (see
// options/presence.ts), and the built-in /help comes for free. Prod runs via
// `tsx src/index.ts`: `dixt build`/`dixt start` use plain tsc + node, which
// can't load our workspace packages that ship TypeScript source (tsx can).
//
// `dixt` is imported FIRST on purpose: importing it runs dotenv-flow, loading
// the .env* files before our env modules validate `process.env`.
import dixt, { dixtDefaults } from "dixt";
import { Events, GatewayIntentBits } from "discord.js";
import { APP_IDENTITY } from "@unicum.gg/shared/app-identity";
import { env } from "./env.js";
import wotPlugin from "./plugins/wot/index.js";
import {
  handleFeedbackModalSubmit,
  isFeedbackModal,
} from "./plugins/wot/commands/feedback.js";
import {
  handleVideoReview,
  isVideoReviewButton,
} from "./plugins/wot/moderation/videos.js";
import {
  handleRatingReview,
  isRatingReviewButton,
} from "./plugins/wot/moderation/reviews.js";
import { bindPresenceClient } from "./lib/presence.js";

async function main(): Promise<void> {
  // dixt defaults to EVERY gateway intent, including the privileged ones the app
  // hasn't enabled ("Used disallowed intents"). A slash-command bot only needs
  // `Guilds` (also what keeps the guild cache warm for the server-count status).
  // dixt deep-merges config with lodash (arrays merge by index, so a shorter
  // `clientOptions.intents` in the config below can't override it), so we replace
  // the default at its source.
  dixtDefaults.clientOptions = { intents: [GatewayIntentBits.Guilds] };

  const bot = new dixt({
    application: {
      id: env.DIXT_APPLICATION_ID,
      name: env.DIXT_APPLICATION_NAME ?? APP_IDENTITY.NAME,
      bot: { token: env.DIXT_BOT_TOKEN },
    },
    // `wot` is a local plugin, registered manually. `dixt-plugin-presence` is
    // auto-discovered from the deps and configured by src/options/presence.ts.
    plugins: [wotPlugin],
  });

  // Give the presence entries access to the client for the server-count line.
  bindPresenceClient(bot.client);

  // dixt routes chat-command + autocomplete interactions, but neither modal
  // submissions nor button presses, so those are handled here on the raw
  // client. The listener is additive (dixt keeps its own) and each branch
  // ignores anything that is not its own `custom_id`.
  bot.client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isModalSubmit() && isFeedbackModal(interaction.customId)) {
      void handleFeedbackModalSubmit(interaction);
      return;
    }
    // The video moderation cards. Routed by `custom_id` rather than by a
    // component collector so the buttons survive a redeploy: a collector's
    // state is in memory, and a card posted before a restart would go dead.
    if (interaction.isButton() && isVideoReviewButton(interaction.customId)) {
      void handleVideoReview(interaction);
      return;
    }
    // The written opinions attached to a tank rating. Same routing rule and the
    // same reason for it; only the prose is on trial, the stars already count.
    if (interaction.isButton() && isRatingReviewButton(interaction.customId)) {
      void handleRatingReview(interaction);
    }
  });

  await bot.start();
  console.log(`[bot] ${APP_IDENTITY.NAME} Discord bot running`);
}

main().catch((err) => {
  console.error("[bot] fatal boot error:", err);
  process.exit(1);
});
