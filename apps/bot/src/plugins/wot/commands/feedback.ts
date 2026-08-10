import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import {
  APP_IDENTITY,
  FeedbackSentiment,
  FeedbackTopic,
  MESSAGE_MAX_LENGTH,
  SENTIMENT_EMOJI,
  SENTIMENT_LABELS,
  SENTIMENT_ORDER,
  TOPIC_LABELS,
} from "@unicum.gg/shared";
import { env } from "../../../env.js";

// The command carries topic + sentiment as real Discord choice options because
// a modal can only hold text inputs (no selects), so the modal itself is just
// the free-text message. Their picks ride to the modal in its `custom_id`.
const CUSTOM_ID_PREFIX = "feedback";
const NO_SENTIMENT = "-";

const isTopic = (v: string): v is FeedbackTopic =>
  (Object.values(FeedbackTopic) as string[]).includes(v);
const isSentiment = (v: string): v is FeedbackSentiment =>
  (Object.values(FeedbackSentiment) as string[]).includes(v);

/** Where the bot POSTs feedback: the same `/api/feedback` the site widget uses
 * (a plain fetch, not the SDK — the endpoint is not modelled there). Mirrors the
 * SDK's base resolution: the internal container in prod, the public URL in dev. */
const apiBase = env.UNICUM_API_URL ?? `${APP_IDENTITY.URL}/api`;

/**
 * `/feedback [topic] [sentiment]` — sends feedback to unicum.gg's private
 * channel, the same place the site's feedback widget posts to. Picking topic /
 * sentiment as options, the command opens a modal for the message; on submit
 * `handleFeedbackModalSubmit` forwards it with the sender's Discord identity.
 */
export const feedbackCommand: DixtSlashCommandBuilder = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription(`Send feedback to the ${APP_IDENTITY.NAME} team`)
    .addStringOption((o) =>
      o
        .setName("topic")
        .setDescription("What it is about (default Other)")
        .addChoices(
          ...Object.values(FeedbackTopic).map((t) => ({
            name: TOPIC_LABELS[t],
            value: t,
          })),
        ),
    )
    .addStringOption((o) =>
      o
        .setName("sentiment")
        .setDescription("How you feel about it (optional)")
        .addChoices(
          ...SENTIMENT_ORDER.map((s) => ({
            name: `${SENTIMENT_EMOJI[s]} ${SENTIMENT_LABELS[s]}`,
            value: s,
          })),
        ),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const topic = interaction.options.getString("topic") ?? FeedbackTopic.Other;
    const sentiment = interaction.options.getString("sentiment") ?? NO_SENTIMENT;

    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:${topic}:${sentiment}`)
      .setTitle("Send feedback")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Your feedback")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(MESSAGE_MAX_LENGTH)
            .setPlaceholder("What's on your mind?"),
        ),
      );

    // showModal must BE the first reply to the command (no defer before it).
    await interaction.showModal(modal);
  },
};

/** True for the modal this command opens, so the bot's interaction listener can
 * route only its own submissions here. */
export function isFeedbackModal(customId: string): boolean {
  return customId.startsWith(`${CUSTOM_ID_PREFIX}:`);
}

/** Handle the feedback modal submission: forward it to the site's feedback
 * endpoint with the submitter's Discord identity, then confirm ephemerally. */
export async function handleFeedbackModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const [, rawTopic, rawSentiment] = interaction.customId.split(":");
  const topic = isTopic(rawTopic) ? rawTopic : FeedbackTopic.Other;
  const sentiment = isSentiment(rawSentiment) ? rawSentiment : undefined;
  const message = interaction.fields.getTextInputValue("message").trim();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const res = await fetch(`${apiBase}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic,
        sentiment,
        message,
        // The submitter is Discord-authenticated at this point, so this is a
        // trustworthy handle (the endpoint still labels it as Discord-sourced).
        discordAuthor: {
          id: interaction.user.id,
          username: interaction.user.username,
        },
      }),
    });
    if (!res.ok) throw new Error(`feedback endpoint returned ${res.status}`);
    await interaction.editReply(
      "Thanks — your feedback reached the team. 🙏",
    );
  } catch (err) {
    console.error("[bot] /feedback delivery failed:", err);
    await interaction.editReply(
      "Something went wrong sending your feedback. Please try again in a moment.",
    );
  }
}
