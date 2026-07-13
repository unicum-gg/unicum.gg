import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
  type EmbedBuilder,
} from "discord.js";

/** Button that promotes the private (ephemeral) reply to a public message. */
const SHARE_ID = "share:public";

/**
 * Edits an already-deferred ephemeral command reply with the embed plus an
 * "Open" link button and a Share button that reposts it publicly in the
 * channel. Shared by /player and /clan so both behave identically.
 *
 * The reply is private by default; only the caller sees the Share button, and a
 * collector (living for the interaction token's 15-minute lifetime) handles the
 * click: it posts a public copy and disables the Share button on the private
 * one to prevent a double post.
 */
export async function editReplyWithShare(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder,
  link: { url: string; label: string },
): Promise<void> {
  const linkButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(link.label)
    .setURL(link.url);
  const shareButton = new ButtonBuilder()
    .setCustomId(SHARE_ID)
    .setStyle(ButtonStyle.Primary)
    .setLabel("Share to channel");
  const rowOf = (...buttons: ButtonBuilder[]) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

  const message = await interaction.editReply({
    embeds: [embed],
    components: [rowOf(shareButton, linkButton)],
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15 * 60_000,
  });
  collector.on("collect", async (i) => {
    if (i.customId !== SHARE_ID) return;
    await i.reply({ embeds: [embed], components: [rowOf(linkButton)] });
    await interaction
      .editReply({
        components: [
          rowOf(
            ButtonBuilder.from(shareButton).setLabel("Shared").setDisabled(true),
            linkButton,
          ),
        ],
      })
      .catch(() => {});
    collector.stop("shared");
  });
  collector.on("end", async (_collected, reason) => {
    if (reason === "shared") return;
    await interaction
      .editReply({
        components: [
          rowOf(ButtonBuilder.from(shareButton).setDisabled(true), linkButton),
        ],
      })
      .catch(() => {});
  });
}
