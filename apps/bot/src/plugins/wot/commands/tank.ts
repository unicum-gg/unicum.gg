import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { DixtSlashCommandBuilder } from "dixt";
import { UnicumError } from "@unicum.gg/sdk";
import {
  APP_IDENTITY,
  SearchSource,
  VEHICLE_CLASS_LABEL_FULL,
} from "@unicum.gg/shared";
import {
  isRegion,
  Region,
  REGION_LABEL,
  REGIONS,
} from "@unicum.gg/wargaming";
import { editReplyWithShare } from "../lib/ephemeral-share.js";
import { tankUrl, wnxColorInt } from "../lib/format.js";
import { unicum } from "../lib/sdk.js";
import { renderTable, type TableRow } from "../lib/table.js";
import { toRoman } from "roman-numerals";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const fmtMetric = (v: number | null): string =>
  v == null ? "—" : intFmt.format(v);
const fmtPct = (v: number | null): string =>
  v == null ? "—" : `${v.toFixed(1)}%`;

// Vehicle tiers as the game renders them (same lib as the site's tank pages).
const romanTier = (tier: number): string =>
  tier > 0 ? toRoman(tier) : String(tier);


/**
 * `/tank <tank> [region]` — the vehicle counterpart of /player and /clan.
 * Autocomplete resolves the catalogue slug; the reply mirrors the tank page's
 * server-average card (players, battles, damage, winrate, WN7/WN8/WNX) plus
 * the current Marks of Excellence thresholds and the Ace Tanker requirement,
 * with a link back to the full unicum.gg tank page.
 */
export const tankCommand: DixtSlashCommandBuilder = {
  data: new SlashCommandBuilder()
    .setName("tank")
    .setDescription(`World of Tanks tank stats from ${APP_IDENTITY.NAME}`)
    .addStringOption((o) =>
      o
        .setName("tank")
        .setDescription("Tank name")
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
    if (focused.name !== "tank") return;
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.respond([]);
      return;
    }
    // Instant suggestions via our own API's streamed search (the vehicle
    // catalogue is a single near-instant local chunk). The API needs 3+
    // chars, so shorter input yields no suggestions yet. The suggestion's
    // value is the canonical slug, which the detail endpoint resolves.
    const query = focused.value.trim();
    if (query.length < 3) {
      await interaction.respond([]);
      return;
    }
    const controller = new AbortController();
    try {
      for await (const chunk of unicum
        .region(region)
        .tanks.searchStream(query, { signal: controller.signal })) {
        if (chunk.source !== SearchSource.Local) break;
        await interaction.respond(
          chunk.results.slice(0, 25).map((t) => ({
            name: `${t.name} (${romanTier(t.tier)} ${t.nation.toUpperCase()})`,
            value: (t as { slug?: string }).slug ?? t.name,
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

    const slug = interaction.options.getString("tank", true).trim();
    const region = interaction.options.getString("region") ?? Region.EU;
    if (!isRegion(region)) {
      await interaction.reply("Unknown region.");
      return;
    }

    // Private by default; the caller can promote it to the channel (Share).
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fetch from our own API: the same composite payload the site's tank page
    // renders. The endpoint resolves legacy ids and wrong-case slugs to the
    // canonical slug. 404 = no such tank in the catalogue.
    let detail;
    try {
      detail = await unicum.region(region).tanks(slug).detail();
    } catch (error) {
      if (error instanceof UnicumError && error.status === 404) {
        await interaction.editReply(
          `No World of Tanks tank matching **${slug}** on ${region.toUpperCase()}. Pick a suggestion from the autocomplete.`,
        );
      } else {
        await interaction.editReply(
          `Couldn't load **${slug}** right now. Try again shortly.`,
        );
      }
      return;
    }

    const { meta, serverStats, moe, mom } = detail;
    const url = tankUrl(region, detail.slug);

    // Identity line above the table, like the motto on /clan.
    const identity = [
      `Tier ${romanTier(meta.tier)}`,
      meta.nation.toUpperCase(),
      VEHICLE_CLASS_LABEL_FULL[meta.type] ?? meta.type,
      meta.isPremium ? "Premium" : null,
      meta.isReward ? "Reward" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    // Server-average card, mirroring the site's tank page summary.
    const rows: TableRow[] = serverStats
      ? [
          { label: "Players", primary: intFmt.format(serverStats.players) },
          {
            label: "Avg battles",
            primary: intFmt.format(serverStats.avg_battles),
          },
          {
            label: "Avg damage",
            primary: intFmt.format(serverStats.avg_damage),
          },
          { label: "Winrate", primary: fmtPct(serverStats.winrate) },
          { label: "WNX", primary: fmtMetric(serverStats.wnx) },
          { label: "WN8", primary: fmtMetric(serverStats.wn8) },
          { label: "WN7", primary: fmtMetric(serverStats.wn7) },
        ]
      : [];
    if (moe) {
      rows.push({
        label: "MoE 1 / 2 / 3",
        primary: `${intFmt.format(moe.mark1)} / ${intFmt.format(moe.mark2)} / ${intFmt.format(moe.mark3)}`,
      });
    }
    if (mom) {
      rows.push({ label: "Ace Tanker XP", primary: intFmt.format(mom.ace) });
    }

    const table =
      rows.length > 0
        ? renderTable(rows)
        : "No server stats recorded for this tank yet.";
    const description = `${identity}\n${table}`;

    const embed = new EmbedBuilder()
      .setColor(wnxColorInt(serverStats?.wnx ?? null))
      .setTitle(meta.name)
      .setURL(url)
      .setDescription(description)
      .setFooter({ text: `${APP_IDENTITY.NAME} · ${region.toUpperCase()}` });
    // The catalogue icon is hosted by WG, so it renders everywhere (unlike the
    // OG image, which Discord can only fetch when the app URL is public).
    if (meta.bigIcon) embed.setThumbnail(meta.bigIcon);
    embed.setImage(`${url}/opengraph-image`);

    await editReplyWithShare(interaction, embed, {
      url,
      label: "Open tank page",
    });
  },
};
