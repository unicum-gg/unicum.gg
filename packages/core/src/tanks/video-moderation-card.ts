// Default-imported, not destructured at the import: the package is CommonJS
// and Node's ESM loader finds no named export on it, so the named form throws
// the moment anything run directly (the worker, a script) reaches this module,
// even transitively. The bundler papers over it, `tsx` does not. Same treatment
// as `videos.ts`, which importing this file used to defeat.
import romanNumerals from "roman-numerals";
import {
  APP_IDENTITY,
  BATTLE_FORMAT_LABEL,
  BATTLE_RESULT_LABEL,
  BRAND_COLOR_INT,
  env,
  FORMAT_TEAM_SIZE,
  FORMAT_TIER,
  MAP_GAME_MODE_LABEL,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@unicum.gg/shared";
import { postChannelEmbedWithComponents } from "@unicum.gg/core/discord";
import type { Oembed, VideoSubmission } from "@unicum.gg/core/tanks/videos";

const { toRoman } = romanNumerals as { toRoman: (n: number) => string };

/**
 * What a moderator is shown, and the two buttons they answer with.
 *
 * Everything below the channel is declared by the submitter and unverifiable
 * from here, which is the whole reason this card exists: the video is embedded
 * at the second it claims, next to the map, the side and the outcome it claims,
 * so the check is one glance rather than a form to cross-reference.
 */

/** `video:approve:<id>` / `video:reject:<id>`, read back by the bot. The row id
 * rides in the button rather than in memory so the buttons keep working across
 * a redeploy, which a component collector would not. */
export const VIDEO_REVIEW_PREFIX = "video";

export async function postModerationCard(
  id: number,
  ref: { videoId: string; startSeconds: number },
  oembed: Oembed,
  s: VideoSubmission,
): Promise<void> {
  const fields: { name: string; value: string; inline: boolean }[] = [
    // The map first on a tactic and the tank first on a random battle: a
    // moderator checks the thing the video is filed under.
    { name: "Map", value: s.mapName, inline: true },
    { name: "Format", value: BATTLE_FORMAT_LABEL[s.format], inline: true },
    { name: "Channel", value: oembed.author_name, inline: true },
    { name: "Submitted by", value: s.submitterName, inline: true },
  ];
  if (s.tankName) {
    fields.push({ name: "Tank", value: s.tankName, inline: true });
  }
  if (s.clanTag) {
    fields.push({ name: "Clan", value: `[${s.clanTag}]`, inline: true });
  }
  if (s.mode) {
    fields.push({
      name: "Mode",
      value: MAP_GAME_MODE_LABEL[s.mode] ?? s.mode,
      inline: true,
    });
  }
  if (s.result) {
    fields.push({
      name: "Result",
      value: BATTLE_RESULT_LABEL[s.result],
      inline: true,
    });
  }
  if (s.combinedDamage != null) {
    fields.push({
      name: "Combined",
      value: s.combinedDamage.toLocaleString("en-US"),
      inline: true,
    });
  }
  // Only where the format leaves them open, so the card says nothing a rule
  // already says.
  const teamSize = FORMAT_TEAM_SIZE[s.format] ?? s.teamSize;
  const tier = FORMAT_TIER[s.format] ?? s.tier;
  if (teamSize) {
    fields.push({
      name: "Team size",
      value: `${teamSize}v${teamSize}`,
      inline: true,
    });
  }
  if (tier) fields.push({ name: "Tier", value: toRoman(tier), inline: true });

  await postChannelEmbedWithComponents(
    env.DISCORD_VIDEO_CHANNEL_ID!,
    {
      title: oembed.title,
      url: youtubeWatchUrl(ref.videoId, ref.startSeconds),
      description: `Opens at the battle. Everything below the channel is declared by the submitter.`,
      color: BRAND_COLOR_INT,
      thumbnail: { url: youtubeThumbnailUrl(ref.videoId) },
      fields,
      // Where the video will show up once it is approved: a tactic lives on its
      // map, a random battle on the tank it was played in.
      footer: {
        text: `${APP_IDENTITY.NAME} · ${
          s.tankSlug
            ? `/${s.region}/tanks/${s.tankSlug}`
            : `/${s.region}/maps/${s.mapSlug}`
        }`,
      },
    },
    [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "Approve",
            custom_id: `${VIDEO_REVIEW_PREFIX}:approve:${id}`,
          },
          {
            type: 2,
            style: 4,
            label: "Reject",
            custom_id: `${VIDEO_REVIEW_PREFIX}:reject:${id}`,
          },
        ],
      },
    ],
  );
}
