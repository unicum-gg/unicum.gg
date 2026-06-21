import { env } from "env";
import type { MessagePayload } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Edits the original (deferred) interaction response. We always answer the
 * initial webhook with a DEFERRED ack inside Discord's 3s window, then call
 * this from `after()` once the WG data is ready. The interaction token is
 * valid for 15 minutes, which is far more than any WG fetch needs.
 */
export async function editInteractionResponse(
  token: string,
  payload: MessagePayload,
): Promise<void> {
  const appId = env.DISCORD_APP_ID;
  if (!appId) return;
  const res = await fetch(
    `${DISCORD_API}/webhooks/${appId}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `discord: failed to edit interaction response (${res.status}): ${body}`,
    );
  }
}
