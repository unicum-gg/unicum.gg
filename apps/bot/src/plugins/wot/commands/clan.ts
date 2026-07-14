import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import { APP_IDENTITY } from "@unicum.gg/shared";
import { searchClansLocal } from "@unicum.gg/core/clans/search-local";
import {
  isRegion,
  Region,
  REGION_LABEL,
  REGIONS,
} from "@unicum.gg/wargaming";
import {
  buildClanWarsBlock,
  buildStrongholdBlock,
} from "../lib/clan-lines.js";
import { editReplyWithShare } from "../lib/ephemeral-share.js";
import { clanUrl, wnxColorInt } from "../lib/format.js";
import { unicum } from "../lib/sdk.js";
import { renderTable } from "../lib/table.js";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const fmtMetric = (v: number | null): string =>
  v == null ? "—" : intFmt.format(v);
const fmtWinrate = (v: number | null): string =>
  v == null ? "—" : `${v.toFixed(1)}%`;

/** Clan tag colour as a Discord embed integer, or null if not a valid hex. */
function clanColorInt(hex: string): number | null {
  const parsed = Number.parseInt(hex.replace("#", ""), 16);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * `/clan <tag> [region]` — the clan counterpart of /player. Works for ANY clan:
 * on a cold DB it resolves the tag on WG and fetches live. Replies with a
 * rating-coloured card of the clan's battle-weighted member ratings (the same
 * aggregation as the site's clan header), plus the clan's OG image and a link
 * back to the full unicum.gg clan page.
 */
export const clanCommand: DixtSlashCommandBuilder = {
  data: new SlashCommandBuilder()
    .setName("clan")
    .setDescription(`World of Tanks clan stats from ${APP_IDENTITY.NAME}`)
    .addStringOption((o) =>
      o
        .setName("tag")
        .setDescription("Clan tag")
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
    if (focused.name !== "tag") return;
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.respond([]);
      return;
    }
    // Instant prefix search over our tracked clans (ordered by member count, so
    // an empty field surfaces the biggest clans). WG's remote clan search is too
    // slow for Discord's 3s autocomplete window.
    const query = focused.value.trim();
    const results = await searchClansLocal(region, query, 25).catch(() => []);
    await interaction.respond(
      results.map((c) => ({ name: `[${c.tag}] ${c.name}`, value: c.tag })),
    );
  },
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const tag = interaction.options.getString("tag", true).trim();
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.reply("Unknown region.");
      return;
    }
    const url = clanUrl(region, tag);

    // Private by default; the caller can promote it to the channel (Share).
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fetch from our own API. The overview endpoint mirrors the site's clan
    // header (profile + battle-weighted member ratings) and handles the cold-DB
    // case server-side: on a miss it resolves the tag on WG and fetches live,
    // which also starts tracking the clan. Any failure → "no clan" (same as the
    // previous DB-first behaviour).
    const overview = await unicum
      .region(region)
      .clans(tag)
      .overview()
      .catch(() => null);
    if (!overview) {
      await interaction.editReply(
        `No World of Tanks clan tagged **[${tag}]** on ${region.toUpperCase()}. Check the tag or the region.`,
      );
      return;
    }
    const { clan, ratings } = overview;
    const { wnx: avgWnx, wn8: avgWn8, wn7: avgWn7 } = ratings.lifetime;
    const avgWinrate = ratings.avgWinrate;

    const languages =
      clan.languages.length > 0
        ? clan.languages.map((l) => l.toUpperCase()).join(", ")
        : "—";

    // Same presentation as /player: an aligned code-block table in the
    // description, with the motto (if any) as a line above it.
    const table = renderTable([
      { label: "Avg WNX", primary: fmtMetric(avgWnx) },
      { label: "Avg WN8", primary: fmtMetric(avgWn8) },
      { label: "Avg WN7", primary: fmtMetric(avgWn7) },
      { label: "Avg winrate", primary: fmtWinrate(avgWinrate) },
      { label: "Members", primary: intFmt.format(clan.membersCount) },
      { label: "Created", primary: dateFmt.format(clan.createdAt) },
      { label: "Creator", primary: clan.creatorName || "—" },
      { label: "Leader", primary: clan.leaderName || "—" },
      { label: "Languages", primary: languages },
    ]);
    // Stronghold and Clan Wars come from the dedicated sub-endpoints (latest
    // snapshot projection), appended only when the clan has data in that
    // category.
    const [stronghold, clanWars] = await Promise.all([
      unicum
        .region(region)
        .clans(tag)
        .stronghold()
        .catch(() => null),
      unicum
        .region(region)
        .clans(tag)
        .clanWars()
        .catch(() => null),
    ]);
    const strongholdBlock = stronghold?.latest
      ? buildStrongholdBlock(stronghold.latest)
      : null;
    const clanWarsBlock = clanWars?.latest
      ? buildClanWarsBlock(clanWars.latest)
      : null;

    const motto = clan.motto.trim();
    let description = motto ? `${motto}\n${table}` : table;
    if (strongholdBlock) description += `\n**Stronghold**\n${strongholdBlock}`;
    if (clanWarsBlock) description += `\n**Clan Wars**\n${clanWarsBlock}`;

    const embed = new EmbedBuilder()
      .setColor(avgWnx !== null ? wnxColorInt(avgWnx) : clanColorInt(clan.color))
      .setTitle(`[${clan.tag}] ${clan.name}`)
      .setURL(url)
      .setDescription(description)
      // The clan's rich card. Discord fetches it server-side, so it only renders
      // when the URL is publicly reachable (i.e. in prod).
      .setImage(`${url}/opengraph-image`)
      .setFooter({ text: `${APP_IDENTITY.NAME} · ${region.toUpperCase()}` });

    await editReplyWithShare(interaction, embed, {
      url,
      label: "Open clan page",
    });
  },
};
