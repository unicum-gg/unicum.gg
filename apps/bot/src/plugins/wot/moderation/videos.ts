import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
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
 *
 * Three presses, and only one of them settles anything on its own. Approve
 * publishes. Reject asks what was wrong first, because a rejection with no
 * reason is a dead end for the person who sent it, and most of them are a
 * correction waiting to happen. Edit leaves Discord entirely: correcting a
 * battle means a map catalogue, a spawn geometry and a tank search that five
 * text boxes cannot hold, so the bot hands back a signed link to the real form.
 */

const PREFIX = "video";
/** The modal the Reject button opens. Its own prefix, since a modal submission
 * is not a button press and the bot routes the two separately. */
const REJECT_MODAL_PREFIX = "video-reject";
const REASON_FIELD = "reason";
const REASON_MAX_LENGTH = 400;

/** The API base, same resolution as the SDK: the internal container in prod,
 * the public URL in dev. */
const apiBase = env.UNICUM_API_URL ?? `${APP_IDENTITY.URL}/api`;

/** True for the buttons this module owns, so the bot's interaction listener can
 * route only its own presses here. */
export function isVideoReviewButton(customId: string): boolean {
  return customId.startsWith(`${PREFIX}:`);
}

/** The same, for the rejection modal's submission. */
export function isVideoRejectModal(customId: string): boolean {
  return customId.startsWith(`${REJECT_MODAL_PREFIX}:`);
}

/** The card, once settled: the verdict goes grey so the channel reads as a
 * queue of things still to do rather than a wall of already-handled cards.
 * Edit stays, because a battle filed under the wrong tank is worth correcting
 * whether or not someone has already approved it, and a correction sends it
 * back through the queue anyway. */
function settledRow(id: string, label: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:done:${id}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:edit:${id}`)
      .setLabel("Edit")
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function handleVideoReview(
  interaction: ButtonInteraction,
): Promise<void> {
  const [, action, rawId] = interaction.customId.split(":");
  // The disabled button left on a settled card; nothing to do if it is somehow
  // pressed.
  if (action === "done") return;

  // Everything below can reject on Discord's side alone (an interaction token
  // that expired while the card sat unread, a 5xx, a rate limit), and these
  // handlers are called as `void handle(...)` from a process that installs no
  // `unhandledRejection` guard. Node's default is to throw on one, which takes
  // the bot down and, after ten of those, has the platform stop it outright. A
  // press that cannot be answered is an ordinary event, not a reason to die.
  try {
    if (action === "edit") return await handleEditRequest(interaction, rawId);
    // Must be the first reply to the interaction: a modal cannot follow a defer.
    if (action === "reject") return await askRejectReason(interaction, rawId);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await settle(interaction, rawId, true, null);
  } catch (err) {
    console.error("[bot] video interaction failed:", err);
  }
}

/** Ask what was wrong, so the submitter is told something they can act on. */
async function askRejectReason(
  interaction: ButtonInteraction,
  rawId: string,
): Promise<void> {
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`${REJECT_MODAL_PREFIX}:${rawId}`)
      .setTitle("Turn this suggestion down")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(REASON_FIELD)
            .setLabel("Why")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(REASON_MAX_LENGTH)
            // Named cases rather than "reason": the useful answer is short and
            // specific, and the submitter reads this verbatim.
            .setPlaceholder(
              "Timestamp is off, wrong map, not the tank claimed, damage doesn't match…",
            ),
        ),
      ),
  );
}

export async function handleVideoRejectModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const [, rawId] = interaction.customId.split(":");
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await settle(
      interaction,
      rawId,
      false,
      interaction.fields.getTextInputValue(REASON_FIELD),
    );
  } catch (err) {
    // `getTextInputValue` throws on a field Discord did not send, which is the
    // same class of problem as a dead token: worth a line in the log, never
    // worth the process.
    console.error("[bot] video rejection failed:", err);
  }
}

/**
 * Record the verdict and take the card out of the queue.
 *
 * Shared by the two paths that reach one: Approve presses the button, Reject
 * arrives from the modal carrying its reason. The card belongs to the message
 * either way, which a modal submission still knows when it was opened from one.
 */
async function settle(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  rawId: string,
  approved: boolean,
  note: string | null,
): Promise<void> {
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
      body: JSON.stringify({ approved, moderatorId: interaction.user.id, note }),
    });

    if (res.status === 409) {
      await interaction.editReply("Already handled by someone else.");
      await interaction.message?.edit({
        components: [settledRow(rawId, "Handled")],
      });
      return;
    }
    if (!res.ok) throw new Error(`review endpoint returned ${res.status}`);

    // The endpoint hands back a public link to where the video now shows (tank
    // videos page, or the map page for a tactic), so the confirmation can point
    // right at it. It may be null if the slug could not be resolved.
    const data = (await res.json().catch(() => null)) as {
      url?: string | null;
    } | null;

    const label = approved ? "Approved" : "Rejected";
    await interaction.editReply(
      approved
        ? data?.url
          ? `Approved. It is live: ${data.url}`
          : "Approved. It is live on the tank page."
        : "Rejected. The submitter is told why, and can correct it from the site.",
    );
    await interaction.message?.edit({
      components: [settledRow(rawId, `${label} by ${interaction.user.username}`)],
    });
  } catch (err) {
    console.error("[bot] video review failed:", err);
    // The apology is best-effort too: the reason the call failed is often the
    // reason this one will.
    await interaction
      .editReply(
        "Could not record that. The suggestion is untouched, try again in a moment.",
      )
      .catch(() => {});
  }
}

/**
 * Answer a press of Edit with a link to the form, visible to the moderator who
 * pressed it and to nobody else.
 *
 * The API mints the link, since it holds the signing secret and the row: this
 * side knows only who pressed.
 */
async function handleEditRequest(
  interaction: ButtonInteraction,
  rawId: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const res = await fetch(`${apiBase}/internal/videos/${rawId}/edit-link`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sharedEnv.CRON_SECRET}`,
      },
      body: JSON.stringify({ moderatorId: interaction.user.id }),
    });
    if (!res.ok) throw new Error(`edit-link endpoint returned ${res.status}`);
    const data = (await res.json().catch(() => null)) as {
      url?: string;
    } | null;
    if (!data?.url) throw new Error("edit-link endpoint answered no url");

    await interaction.editReply(
      `Correct it here: ${data.url}\nThe link is yours alone and expires in 30 minutes. Saving sends the suggestion back to this queue.`,
    );
  } catch (err) {
    console.error("[bot] video edit link failed:", err);
    await interaction
      .editReply(
        "Could not open that one for editing. The suggestion is untouched, try again in a moment.",
      )
      .catch(() => {});
  }
}
