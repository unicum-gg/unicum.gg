import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";
import { APP_IDENTITY, env as sharedEnv } from "@unicum.gg/shared";
import { env } from "../../../env.js";

/**
 * Moderation of the community-suggested tank videos.
 *
 * The card is posted by the web app when someone submits; this side only
 * handles the presses, because the gateway connection is the one thing the web
 * app does not have. The decision is then sent back to the API, which owns the
 * database.
 *
 * The row id travels in the button's `custom_id` rather than in a component
 * collector, deliberately: a collector lives in memory and dies with the
 * process, which would leave a queue of dead buttons after every redeploy. A
 * `custom_id` is on Discord's side, so a card posted last week still works.
 */

const PREFIX = "video";

/** The API base, same resolution as the SDK: the internal container in prod,
 * the public URL in dev. */
const apiBase = env.UNICUM_API_URL ?? `${APP_IDENTITY.URL}/api`;

/** True for the buttons this module owns, so the bot's interaction listener can
 * route only its own presses here. */
export function isVideoReviewButton(customId: string): boolean {
  return customId.startsWith(`${PREFIX}:`);
}

/** The card, once settled: the buttons go away so the channel reads as a queue
 * of things still to do rather than a wall of already-handled cards. */
function settledRow(label: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:done`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}

export async function handleVideoReview(
  interaction: ButtonInteraction,
): Promise<void> {
  const [, action, rawId] = interaction.customId.split(":");
  // The disabled button left on a settled card; nothing to do if it is somehow
  // pressed.
  if (action === "done") return;

  const approved = action === "approve";
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const res = await fetch(`${apiBase}/internal/videos/${rawId}/review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // The web and the bot are both our own services; the moderator's
        // identity is already established by Discord having delivered this
        // interaction, so the shared secret only authenticates the caller.
        authorization: `Bearer ${sharedEnv.CRON_SECRET}`,
      },
      body: JSON.stringify({ approved, moderatorId: interaction.user.id }),
    });

    if (res.status === 409) {
      await interaction.editReply("Already handled by someone else.");
      await interaction.message.edit({ components: [settledRow("Handled")] });
      return;
    }
    if (!res.ok) throw new Error(`review endpoint returned ${res.status}`);

    const label = approved ? "Approved" : "Rejected";
    await interaction.editReply(
      approved
        ? "Approved. It is live on the tank page."
        : "Rejected. It stays out, and the same battle cannot be submitted again.",
    );
    await interaction.message.edit({
      components: [settledRow(`${label} by ${interaction.user.username}`)],
    });
  } catch (err) {
    console.error("[bot] video review failed:", err);
    await interaction.editReply(
      "Could not record that. The suggestion is untouched, try again in a moment.",
    );
  }
}
