import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import { APP_IDENTITY } from "@unicum.gg/core/app-identity";
import { overallPoints } from "@unicum.gg/core/clans/members";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import { searchClansLocal } from "@unicum.gg/core/clans/search-local";
import { getLatestClanSnapshot } from "@unicum.gg/core/clans/snapshots";
import {
  globalMapStatsFromClanSnapshot,
  strongholdStatsFromClanSnapshot,
} from "@unicum.gg/core/clans/snapshot-stats";
import { weightedAverage } from "@unicum.gg/core/lib/stats";
import {
  isRegion,
  Region,
  REGION_LABEL,
  REGIONS,
} from "@unicum.gg/wargaming/region";
import {
  buildClanWarsBlock,
  buildStrongholdBlock,
} from "../lib/clan-lines.js";
import { editReplyWithShare } from "../lib/ephemeral-share.js";
import { clanUrl, wnxColorInt } from "../lib/format.js";
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

    // DB first, resolving on WG and fetching live on a cold miss (this also
    // starts tracking the clan, so a Discord lookup feeds the DB).
    const cached = await getClanByTagCached(region, tag).catch(() => null);
    if (!cached) {
      await interaction.editReply(
        `No World of Tanks clan tagged **[${tag}]** on ${region.toUpperCase()}. Check the tag or the region.`,
      );
      return;
    }
    const clan = cached.info;

    // Battle-weighted member ratings, exactly like the site's clan header. Empty
    // (a brand-new clan whose members haven't been cached yet) leaves them at
    // "—"; the info and OG image still render.
    const cachedMembers = await getClanMembersCached(region, clan.id).catch(
      () => null,
    );
    const members = cachedMembers?.members ?? [];
    const avgWnx = weightedAverage(overallPoints(members, (m) => m.wnx));
    const avgWn8 = weightedAverage(overallPoints(members, (m) => m.wn8));
    const avgWn7 = weightedAverage(overallPoints(members, (m) => m.wn7));
    const avgWinrate = weightedAverage(
      overallPoints(members, (m) => m.overall?.winsPercentage ?? null),
    );

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
    // Stronghold and Clan Wars come from the latest clan snapshot, and are only
    // appended when the clan actually has data in that category.
    const snapshot = await getLatestClanSnapshot(region, clan.id).catch(
      () => null,
    );
    const strongholdBlock = snapshot
      ? buildStrongholdBlock(strongholdStatsFromClanSnapshot(snapshot))
      : null;
    const clanWarsBlock = snapshot
      ? buildClanWarsBlock(globalMapStatsFromClanSnapshot(snapshot))
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
