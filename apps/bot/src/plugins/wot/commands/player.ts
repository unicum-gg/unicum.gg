import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import { UnicumError } from "@unicum.gg/sdk";
import { APP_IDENTITY, SearchSource } from "@unicum.gg/shared";
import {
  isRegion,
  Region,
  REGION_LABEL,
  REGIONS,
} from "@unicum.gg/wargaming";
import { editReplyWithShare } from "../lib/ephemeral-share.js";
import { playerUrl, wnxColorInt } from "../lib/format.js";
import { unicum } from "../lib/sdk.js";
import { buildStatsBlock } from "../lib/stats-lines.js";

/**
 * `/player <nickname> [region]` — the flagship command. Works for ANY player,
 * not just tracked ones: on a miss it resolves the account on WG, fetches live,
 * and records a snapshot (which also starts tracking them, so every lookup grows
 * the DB). Replies with a rating-coloured card: the full overall stats table
 * (the same rows as the site's player page), the profile's OG image, and a link
 * back to the full unicum.gg profile.
 */
export const playerCommand: DixtSlashCommandBuilder = {
  data: new SlashCommandBuilder()
    .setName("player")
    .setDescription(`World of Tanks player stats from ${APP_IDENTITY.NAME}`)
    .addStringOption((o) =>
      o
        .setName("nickname")
        .setDescription("Player nickname")
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
    if (focused.name !== "nickname") return;
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.respond([]);
      return;
    }
    // Instant suggestions via our own API's streamed search: the first NDJSON
    // chunk is the local DB hit (near-instant, well inside Discord's 3s
    // window); we respond with it and abort before the slow WG chunk.
    // Typed 3+ chars (the API minimum): search that. Shorter: guess the
    // caller's own account from their Discord display name (in a WoT community
    // it's usually their in-game name).
    const typed = focused.value.trim();
    const self = interaction.inCachedGuild()
      ? interaction.member.displayName
      : (interaction.user.globalName ?? interaction.user.username);
    const q = typed.length >= 3 ? typed : self.trim();
    if (q.length < 3) {
      await interaction.respond([]);
      return;
    }
    const controller = new AbortController();
    try {
      for await (const chunk of unicum
        .region(region)
        .players.searchStream(q, { signal: controller.signal })) {
        if (chunk.source !== SearchSource.Local) break;
        await interaction.respond(
          chunk.results.map((r) => ({
            name: r.clan ? `${r.nickname} [${r.clan.tag}]` : r.nickname,
            value: r.nickname,
          })),
        );
        break;
      }
    } catch {
      await interaction.respond([]).catch(() => {});
    } finally {
      controller.abort();
    }
  },
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const nickname = interaction.options.getString("nickname", true).trim();
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.reply("Unknown region.");
      return;
    }
    const url = playerUrl(region, nickname);

    // Private by default; the caller can promote it to the channel (see below).
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fetch from our own API (same data the site's player page renders). The
    // endpoint handles the cold-DB case server-side: on a miss it resolves the
    // account on WG, fetches live, and records a snapshot (which also starts
    // tracking the player, so every lookup grows the DB). 404 = no such player;
    // 403 = account locked by WG; any other failure (e.g. WG upstream) → "try again".
    let detail;
    try {
      detail = await unicum.region(region).players(nickname).detail();
    } catch (error) {
      if (error instanceof UnicumError && error.status === 404) {
        await interaction.editReply(
          `No World of Tanks player named **${nickname}** on ${region.toUpperCase()}. Check the spelling or the region.`,
        );
      } else if (error instanceof UnicumError && error.status === 403) {
        // The endpoint answers 403 "account_locked" when WG resolves the
        // nickname but has locked the account (no stats available).
        await interaction.editReply(
          `**${nickname}** exists on ${region.toUpperCase()}, but Wargaming has locked this account, so its stats are not available.`,
        );
      } else {
        await interaction.editReply(
          `Couldn't load **${nickname}** from Wargaming right now. Try again shortly: ${url}`,
        );
      }
      return;
    }

    const clan = detail.clanHistory.currentStint?.clan ?? null;

    const embed = new EmbedBuilder()
      .setColor(wnxColorInt(detail.derived.wnx.total))
      .setTitle(
        clan ? `${detail.player.nickname} [${clan.tag}]` : detail.player.nickname,
      )
      .setURL(url)
      // The full stats table, mirroring the site's player page (overall column).
      .setDescription(buildStatsBlock(detail.current, detail.derived))
      // The player's rich stats card. Discord fetches it server-side, so it
      // only renders when the URL is publicly reachable (i.e. in prod).
      .setImage(`${url}/opengraph-image`)
      .setFooter({ text: `${APP_IDENTITY.NAME} · ${region.toUpperCase()}` })
      .setTimestamp(detail.player.updatedAt);

    await editReplyWithShare(interaction, embed, {
      url,
      label: "Open full profile",
    });
  },
};
