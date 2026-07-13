import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import { APP_IDENTITY } from "@unicum.gg/core/app-identity";
import { DEFAULT_RATING_METRIC } from "@unicum.gg/core/constants/rating";
import { recordCurrentSnapshot } from "@unicum.gg/core/players";
import { loadPlayerDetail } from "@unicum.gg/core/players/detail";
import { searchPlayersLocal } from "@unicum.gg/core/players/search-local";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@unicum.gg/core/wargaming/wot/accounts";
import { getTanksStats } from "@unicum.gg/core/wargaming/wot/tanks";
import {
  isRegion,
  Region,
  REGION_LABEL,
  REGIONS,
} from "@unicum.gg/wargaming/region";
import { editReplyWithShare } from "../lib/ephemeral-share.js";
import { playerUrl, wnxColorInt } from "../lib/format.js";
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
    // Instant prefix search over our tracked players (the local half of the
    // site's search; WG's remote search is too slow for Discord's 3s window).
    // Typed 3+ chars: search that. Empty/short field: suggest the caller's own
    // account first (their Discord name is usually their WoT nickname), then
    // fall back to the most-tracked players so focusing the field is never empty.
    const typed = focused.value.trim();
    // Empty/short field: guess the caller's own account. Prefer their per-server
    // nickname (in a WoT community it's usually their in-game name), then their
    // global Discord name, then username — exactly what `displayName` resolves.
    const self = interaction.inCachedGuild()
      ? interaction.member.displayName
      : (interaction.user.globalName ?? interaction.user.username);
    let results = await searchPlayersLocal(
      region,
      typed.length >= 3 ? typed : self.trim(),
      25,
    ).catch(() => []);
    if (results.length === 0 && typed.length < 3) {
      results = await searchPlayersLocal(region, "", 25).catch(() => []);
    }
    await interaction.respond(
      results.map((r) => ({
        name: r.clan ? `${r.nickname} [${r.clan.tag}]` : r.nickname,
        value: r.nickname,
      })),
    );
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

    // 1. Everything the tracker already has, computed exactly like the site's
    //    player page (same `loadPlayerDetail`: overall stats + tank-derived rows).
    let detail = await loadPlayerDetail(region, nickname, DEFAULT_RATING_METRIC);

    // 2. Cold DB: resolve the account on WG, fetch live, and record a snapshot
    //    (this also starts tracking the player), then read the detail back.
    if (!detail) {
      const found = await findPlayerByNickname(region, nickname).catch(
        () => null,
      );
      if (!found) {
        await interaction.editReply(
          `No World of Tanks player named **${nickname}** on ${region.toUpperCase()}. Check the spelling or the region.`,
        );
        return;
      }
      const info = await getPlayerInfo(region, found.account_id).catch(
        () => null,
      );
      if (!info) {
        await interaction.editReply(
          `Couldn't load **${nickname}** from Wargaming right now. Try again shortly: ${url}`,
        );
        return;
      }
      const [tanks, wtr] = await Promise.all([
        getTanksStats(region, found.account_id).catch(() => []),
        getAccountWTR(region, found.account_id).catch(() => null),
      ]);
      const recorded = await recordCurrentSnapshot(region, info, wtr, tanks);
      detail = await loadPlayerDetail(
        region,
        recorded.player.nickname,
        DEFAULT_RATING_METRIC,
      );
      if (!detail) {
        await interaction.editReply(
          `Couldn't load **${nickname}** from Wargaming right now. Try again shortly: ${url}`,
        );
        return;
      }
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
