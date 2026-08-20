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
 * Moderation of the written opinions attached to a tank rating.
 *
 * Same split as the video queue: the card is posted by the web app when someone
 * writes one, and this side only handles the presses, because the gateway
 * connection is the one thing the web app does not have. The decision goes back
 * to the API, which owns the database.
 *
 * Only the prose is on trial. The stars were counted the moment they were cast,
 * so a rejection here takes the sentence down and leaves the vote standing,
 * which is why the replies below are careful to say so.
 */

const PREFIX = "rating";

/** The API base, same resolution as the SDK: the internal container in prod,
 * the public URL in dev. */
const apiBase = env.UNICUM_API_URL ?? `${APP_IDENTITY.URL}/api`;

/** True for the buttons this module owns, so the bot's interaction listener can
 * route only its own presses here. */
export function isRatingReviewButton(customId: string): boolean {
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

export async function handleRatingReview(
  interaction: ButtonInteraction,
): Promise<void> {
  const [, action, rawId, digest] = interaction.customId.split(":");
  // The disabled button left on a settled card; nothing to do if it is somehow
  // pressed.
  if (action === "done") return;

  const approved = action === "approve";
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const res = await fetch(`${apiBase}/internal/tank-ratings/${rawId}/review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // The web and the bot are both our own services; the moderator's
        // identity is already established by Discord having delivered this
        // interaction, so the shared secret only authenticates the caller.
        authorization: `Bearer ${sharedEnv.CRON_SECRET}`,
      },
      body: JSON.stringify({
        approved,
        moderatorId: interaction.user.id,
        // Echoed back so the API can refuse a card whose text has since been
        // rewritten. Without it, pressing Publish on an old card would publish
        // whatever the author replaced it with.
        digest,
      }),
    });

    if (res.status === 409) {
      const { error } = ((await res.json().catch(() => null)) ?? {}) as {
        error?: string;
      };
      const stale = error === "stale";
      await interaction.editReply(
        stale
          ? "That text has been rewritten since this card. A newer card carries what they wrote now."
          : "Already handled by someone else.",
      );
      await interaction.message.edit({
        components: [settledRow(stale ? "Superseded" : "Handled")],
      });
      return;
    }
    if (!res.ok) throw new Error(`review endpoint returned ${res.status}`);

    const data = (await res.json().catch(() => null)) as {
      url?: string | null;
    } | null;

    const label = approved ? "Published" : "Rejected";
    await interaction.editReply(
      approved
        ? data?.url
          ? `Published. It is live: ${data.url}`
          : "Published. It is live on the tank page."
        : "Rejected. The text stays down; their stars still count towards the average.",
    );
    await interaction.message.edit({
      components: [settledRow(`${label} by ${interaction.user.username}`)],
    });
  } catch (err) {
    console.error("[bot] rating review failed:", err);
    await interaction.editReply(
      "Could not record that. The review is untouched, try again in a moment.",
    );
  }
}
