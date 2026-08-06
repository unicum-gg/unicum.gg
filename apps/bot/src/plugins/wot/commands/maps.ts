import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import { UnicumError } from "@unicum.gg/sdk";
import {
  APP_IDENTITY,
  BATTLE_TYPE_LABEL,
  BattleType,
  MAP_CAMOUFLAGE_LABEL,
  MAP_GAME_MODE_LABEL,
  TEAM_SIZE_BATTLE_TYPES,
  type MapCamouflage,
  type MapGameMode,
} from "@unicum.gg/shared";
import {
  isRegion,
  Region,
  REGION_LABEL,
  REGIONS,
} from "@unicum.gg/wargaming";
import { editReplyWithShare } from "../lib/ephemeral-share.js";
import { BRAND_COLOR_INT, mapUrl } from "../lib/format.js";
import { unicum, unicumPublic } from "../lib/sdk.js";
import { renderTable, type TableRow } from "../lib/table.js";

/** The battle timer as the game shows it (`15:00`). */
function roundClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

// The map's own blurb, trimmed to a line or two: Discord allows 4096 characters
// in a description, but the card is a summary, not the page.
const BLURB_MAX = 280;
const blurb = (text: string): string | null => {
  const clean = text.trim();
  if (clean.length === 0) return null;
  return clean.length <= BLURB_MAX
    ? clean
    : `${clean.slice(0, BLURB_MAX).trimEnd()}…`;
};

/**
 * `/maps <map> [region]` — the battle-map counterpart of /player, /clan and
 * /tank. Autocomplete resolves the catalogue slug; the reply mirrors the map
 * page's summary (camouflage, size, battle timer, team size, game modes and the
 * battle types it is played in) with the minimap as the card image and a link
 * back to the full unicum.gg map page.
 */
export const mapsCommand: DixtSlashCommandBuilder = {
  data: new SlashCommandBuilder()
    .setName("maps")
    .setDescription(`World of Tanks battle maps from ${APP_IDENTITY.NAME}`)
    .addStringOption((o) =>
      o
        .setName("map")
        .setDescription("Map name")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("Region (default EU)")
        .addChoices(
          ...REGIONS.map((r) => ({
            name:
              r === Region.EU ? `${REGION_LABEL[r]} (default)` : REGION_LABEL[r],
            value: r,
          })),
        ),
    ),
  autocomplete: async (interaction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "map") return;
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.respond([]);
      return;
    }
    // The catalogue is served from memory, so a plain request answers well
    // inside Discord's 3s window (no need for the streamed search /tank uses to
    // skip its slow remote chunk). The API needs 3+ characters, so shorter
    // input yields no suggestions yet, and it answers with its own top 5.
    const query = focused.value.trim();
    if (query.length < 3) {
      await interaction.respond([]);
      return;
    }
    try {
      const { results } = await unicum.region(region).maps.search(query);
      await interaction.respond(
        results.slice(0, 25).map((m) => ({ name: m.name, value: m.slug })),
      );
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  },
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const slug = interaction.options.getString("map", true).trim();
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.reply("Unknown region.");
      return;
    }

    // Private by default; the caller can promote it to the channel (Share).
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Same payload the site's map page renders. 404 = no such map in the
    // catalogue (it is derived from the game's client scripts, so it only ever
    // holds arenas in the current rotation).
    let detail;
    try {
      detail = await unicum.region(region).maps(slug).detail();
    } catch (error) {
      if (error instanceof UnicumError && error.status === 404) {
        await interaction.editReply(
          `No World of Tanks map matching **${slug}**. Pick a suggestion from the autocomplete.`,
        );
      } else {
        await interaction.editReply(
          `Couldn't load **${slug}** right now. Try again shortly.`,
        );
      }
      return;
    }

    const battleTypes = detail.battleTypes as BattleType[];
    // A symmetric team size only means something on even-sided PvP maps: Battle
    // Royale is a free-for-all and the PvE events have their own wave structure,
    // so the page and the OG card both suppress it there. Same rule here.
    const symmetric =
      detail.maxPlayersInTeam > 0 &&
      battleTypes.some((type) => TEAM_SIZE_BATTLE_TYPES.has(type));

    const rows: TableRow[] = [];
    if (detail.sizeMeters > 0) {
      rows.push({ label: "Size", primary: `${detail.sizeMeters} m` });
    }
    if (detail.roundLength > 0) {
      rows.push({
        label: "Battle time",
        primary: roundClock(detail.roundLength),
      });
    }
    if (symmetric) {
      rows.push({
        label: "Team size",
        primary: `${detail.maxPlayersInTeam}v${detail.maxPlayersInTeam}`,
      });
    }

    const description = [
      MAP_CAMOUFLAGE_LABEL[detail.camouflage as MapCamouflage],
      blurb(detail.description),
      rows.length > 0 ? renderTable(rows) : null,
    ]
      .filter(Boolean)
      .join("\n");

    const url = mapUrl(region, detail.slug);
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR_INT)
      .setTitle(detail.name)
      .setURL(url)
      .setDescription(description)
      .setFooter({ text: `${APP_IDENTITY.NAME} · ${region.toUpperCase()}` });

    const modes = detail.modes as MapGameMode[];
    if (modes.length > 0) {
      embed.addFields({
        name: "Game modes",
        value: modes.map((mode) => MAP_GAME_MODE_LABEL[mode]).join(", "),
        inline: true,
      });
    }
    // Where the map is actually played. This is the one thing the card adds over
    // the page's own stat row, and it is what a Discord reader wants to know
    // ("is this a Clan Wars map?"). Training is dropped: every arena is playable
    // in a training room, so listing it says nothing and crowds out the rest.
    const played = battleTypes.filter((type) => type !== BattleType.Training);
    if (played.length > 0) {
      embed.addFields({
        name: "Battle types",
        value: played.map((type) => BATTLE_TYPE_LABEL[type]).join(", "),
        inline: true,
      });
    }

    // The minimap comes from our own asset mirror, so it renders everywhere.
    embed.setThumbnail(detail.minimapUrl);
    embed.setImage(unicumPublic.og.region(region).maps(detail.slug).url());

    await editReplyWithShare(interaction, embed, {
      url,
      label: "Open map page",
    });
  },
};
