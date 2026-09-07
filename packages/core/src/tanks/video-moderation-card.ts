// Default-imported, not destructured at the import: the package is CommonJS
// and Node's ESM loader finds no named export on it, so the named form throws
// the moment anything run directly (the worker, a script) reaches this module,
// even transitively. The bundler papers over it, `tsx` does not. Same treatment
// as `videos.ts`, which importing this file used to defeat.
import romanNumerals from "roman-numerals";
import type {
  APIActionRowComponent,
  APIComponentInMessageActionRow,
  APIEmbed,
} from "discord-api-types/v10";
import {
  APP_IDENTITY,
  BATTLE_FORMAT_LABEL,
  BATTLE_RESULT_LABEL,
  BattleFormat,
  BattleResult,
  BRAND_COLOR_INT,
  env,
  FORMAT_TEAM_SIZE,
  FORMAT_TIER,
  MAP_GAME_MODE_LABEL,
  TankVideoStatus,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type MapGameMode,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  editChannelComponents,
  editChannelEmbedWithComponents,
  postChannelEmbedWithComponents,
} from "@unicum.gg/core/discord";
import type { Oembed } from "@unicum.gg/core/tanks/video-checks";

const { toRoman } = romanNumerals as { toRoman: (n: number) => string };

/**
 * What a moderator is shown, and the buttons they answer with.
 *
 * Everything below the channel is declared by the submitter and unverifiable
 * from here, which is the whole reason this card exists: the video is embedded
 * at the second it claims, next to the map, the side and the outcome it claims,
 * so the check is one glance rather than a form to cross-reference.
 *
 * The card is also rewritten in place when a submission is corrected, which is
 * why the embed is built from a context object rather than inline: an edit has
 * a row and no submission, and a queue is only useful while a card means one
 * thing to do.
 */

/** `video:approve:<id>` / `video:reject:<id>` / `video:edit:<id>`, read back by
 * the bot. The row id rides in the button rather than in memory so the buttons
 * keep working across a redeploy, which a component collector would not. */
export const VIDEO_REVIEW_PREFIX = "video";

/**
 * What the card says about a battle, from either side of the queue.
 *
 * `VideoSubmission` satisfies it as it is; the edit path builds one from the
 * stored row, resolving the names the row holds ids for.
 */
export type VideoCardContext = {
  tankName: string | null;
  tankSlug: string | null;
  mapName: string;
  mapSlug: string;
  region: Region;
  mode: MapGameMode;
  spawnTeam: 1 | 2;
  result: BattleResult;
  format: BattleFormat;
  combinedDamage: number | null;
  teamSize?: number | null;
  tier?: number | null;
  clanTag?: string | null;
  submitterName: string;
  /** What a correction moved, when this card is being drawn for one. The fields
   * below say what the battle is now; these say what it stopped being, which is
   * the part a moderator who already read this card cannot see. */
  changes?: { field: string; from: string; to: string }[];
  /** What the row was before the correction, when this card is being drawn for
   * one. Not a boolean: a video pulled off the site and a rejection sent back
   * for another look are both "requeued", and telling a moderator the wrong one
   * of the two is telling them something false about what is live. */
  previousStatus?: TankVideoStatus;
};

function buildEmbed(
  ref: { videoId: string; startSeconds: number },
  oembed: Oembed,
  s: VideoCardContext,
): APIEmbed {
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

  // Last, and full width: it is read once, against a card whose other fields
  // are the answer. Capped because a Discord field holds 1024 characters and an
  // edit that moved everything would otherwise cost the card its whole embed.
  if (s.previousStatus && !s.changes?.length) {
    fields.push({
      name: "Corrected",
      value: "Saved without changing any field.",
      inline: false,
    });
  }
  if (s.changes?.length) {
    const lines = s.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`);
    const shown: string[] = [];
    let budget = 1000;
    for (const line of lines) {
      if (budget - line.length < 0) break;
      budget -= line.length + 1;
      shown.push(line);
    }
    const hidden = lines.length - shown.length;
    if (hidden > 0) shown.push(`…and ${hidden} more`);
    fields.push({ name: "Corrected", value: shown.join("\n"), inline: false });
  }

  return {
    title: oembed.title,
    url: youtubeWatchUrl(ref.videoId, ref.startSeconds),
    // Said on the card rather than left to be noticed: a moderator who read
    // this one an hour ago is looking at different claims now, and the fields
    // themselves cannot show that they moved. Derived from the changes rather
    // than declared, so a card cannot claim a correction it does not list.
    // Driven by what the row was, never by whether the diff found anything to
    // say: a save that touched nothing still takes a published video off the
    // site, and a card that stayed silent about that would leave a moderator
    // unaware that something is down.
    description:
      s.previousStatus === TankVideoStatus.Approved
        ? "Corrected after it was published, so it is off the site until this is approved again. Opens at the battle."
        : s.previousStatus === TankVideoStatus.Rejected
          ? "Turned down, then corrected. Back for another look, and it publishes nothing until you say so. Opens at the battle."
          : s.previousStatus === TankVideoStatus.Pending
            ? "Corrected since it was sent. Opens at the battle, and everything below the channel is declared by the submitter."
            : "Opens at the battle. Everything below the channel is declared by the submitter.",
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
  };
}

/**
 * The buttons under the card.
 *
 * Edit sits beside the verdict rather than replacing it, and survives the
 * verdict: a battle filed under the wrong tank is worth correcting whether or
 * not someone has already approved it, and a correction sends it back through
 * the queue anyway.
 */
export function cardComponents(
  id: number,
  settled: string | null,
): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  const verdict: APIComponentInMessageActionRow[] = settled
    ? [
        {
          type: 2,
          style: 2,
          label: settled,
          custom_id: `${VIDEO_REVIEW_PREFIX}:done:${id}`,
          disabled: true,
        },
      ]
    : [
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
      ];
  return [
    {
      type: 1,
      components: [
        ...verdict,
        {
          type: 2,
          style: 2,
          label: "Edit",
          custom_id: `${VIDEO_REVIEW_PREFIX}:edit:${id}`,
        },
      ],
    },
  ];
}

/** Post the card for a freshly queued submission. Answers with the Discord
 * message id, which the row keeps so a later correction can rewrite this exact
 * card instead of posting a second one. */
export async function postModerationCard(
  id: number,
  ref: { videoId: string; startSeconds: number },
  oembed: Oembed,
  s: VideoCardContext,
): Promise<string | null> {
  return postChannelEmbedWithComponents(
    env.DISCORD_VIDEO_CHANNEL_ID!,
    buildEmbed(ref, oembed, s),
    cardComponents(id, null),
  );
}

/**
 * Rewrite the card of a submission that was corrected.
 *
 * Best-effort: the correction is stored either way, and a card that could not
 * be rewritten (deleted, purged, posted before the id was recorded) must not
 * fail the edit. The caller falls back to posting a fresh card when there is no
 * message to rewrite.
 */
export async function updateModerationCard(
  messageId: string,
  id: number,
  ref: { videoId: string; startSeconds: number },
  oembed: Oembed,
  s: VideoCardContext,
): Promise<boolean> {
  return editChannelEmbedWithComponents(
    env.DISCORD_VIDEO_CHANNEL_ID!,
    messageId,
    buildEmbed(ref, oembed, s),
    cardComponents(id, null),
  );
}

/**
 * Leave an old card readable but inert.
 *
 * Used when a correction pulled a settled row back into the queue and a fresh
 * card was posted for it: the history must not hold two live cards for one row,
 * and someone scrolling back has to be able to tell which one to act on.
 */
export async function supersedeModerationCard(
  messageId: string,
): Promise<boolean> {
  return editChannelComponents(env.DISCORD_VIDEO_CHANNEL_ID!, messageId, [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: "Corrected since, see the newer card",
          custom_id: `${VIDEO_REVIEW_PREFIX}:done:superseded`,
          disabled: true,
        },
      ],
    },
  ]);
}
