import type { Interaction } from "discord.js";
import { APP_IDENTITY, env as sharedEnv } from "@unicum.gg/shared";
import { env } from "./env.js";

/** The API base, same resolution as the SDK: the internal container in prod,
 * the public URL in dev. */
const apiBase = env.UNICUM_API_URL ?? `${APP_IDENTITY.URL}/api`;

/**
 * Report a slash command to the API, which counts it for the bot page's usage
 * panel. Autocomplete is not a command (it fires on every keystroke), and
 * neither are button presses, so only a submitted command counts.
 *
 * Never awaited by the caller and never thrown: a count is not worth delaying
 * a reply, and Discord gives a reply three seconds.
 */
export function reportCommand(interaction: Interaction): void {
  if (!interaction.isChatInputCommand()) return;
  fetch(`${apiBase}/internal/usage/bot-command`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${sharedEnv.CRON_SECRET}`,
    },
    body: JSON.stringify({ command: interaction.commandName }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err: unknown) => {
    console.warn("[bot] counting a command failed:", err);
  });
}
