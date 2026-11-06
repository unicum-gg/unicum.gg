// Alerts to a Discord webhook. A failed post is logged and swallowed: an alert
// that cannot be delivered must not take the publisher down with it.
import { config } from "./config.js";

export async function notify(message: string): Promise<void> {
  console.log(`[wgmods] notify: ${message}`);
  if (!config.discordWebhook) return;
  try {
    const response = await fetch(config.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) console.error(`[wgmods] discord answered ${response.status}`);
  } catch (error) {
    console.error("[wgmods] discord unreachable", error);
  }
}

export const loginLink = () => `${config.publicUrl}/login?token=${config.loginToken}`;
