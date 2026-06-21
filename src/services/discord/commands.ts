import {
  findPlayerByNickname,
  getPlayerInfo,
  type PlayerSearchResult,
} from "@/services/wargaming/wot/accounts";
import { isRegion, Region, REGIONS } from "@/services/wargaming/wot";
import { editInteractionResponse } from "./rest";
import { buildPlayerStatCard, notFoundEmbed } from "./embeds";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  type Interaction,
  type InteractionOption,
} from "./types";

function optionValue(
  options: InteractionOption[] | undefined,
  name: string,
): string | undefined {
  const opt = options?.find((o) => o.name === name);
  return opt?.value === undefined ? undefined : String(opt.value);
}

type ResolvedPlayer = { region: Region; result: PlayerSearchResult };

/**
 * Resolves a nickname to a single account. When the caller pins a region we
 * query just that one; otherwise we race all three and prefer the first hit in
 * REGIONS order. This is what makes `/wot stats` a single cross-region command.
 */
async function resolvePlayer(
  nickname: string,
  region: Region | null,
): Promise<ResolvedPlayer | null> {
  const regions = region ? [region] : REGIONS;
  const hits = await Promise.all(
    regions.map(async (r) => {
      const result = await findPlayerByNickname(r, nickname);
      return result ? { region: r, result } : null;
    }),
  );
  return hits.find((h): h is ResolvedPlayer => h !== null) ?? null;
}

async function executeStats(
  interaction: Interaction,
  options: InteractionOption[] | undefined,
): Promise<void> {
  const nickname = optionValue(options, "player")?.trim();
  if (!nickname) {
    await editInteractionResponse(interaction.token, {
      content: "Usage: `/wot stats player:<name> [region]`",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const regionOpt = optionValue(options, "region");
  const region = regionOpt && isRegion(regionOpt) ? regionOpt : null;

  const resolved = await resolvePlayer(nickname, region);
  if (!resolved) {
    await editInteractionResponse(interaction.token, {
      embeds: [notFoundEmbed(nickname)],
    });
    return;
  }

  const info = await getPlayerInfo(resolved.region, resolved.result.account_id);
  if (!info) {
    await editInteractionResponse(interaction.token, {
      embeds: [notFoundEmbed(nickname)],
    });
    return;
  }

  await editInteractionResponse(interaction.token, {
    embeds: [buildPlayerStatCard(resolved.region, info)],
  });
}

/**
 * Runs the slash command after the deferred ack has been sent. Any throw here
 * is swallowed into a user-facing error edit so the interaction never hangs on
 * the spinner (WG and G-Core failures are normal operation, not exceptions).
 */
export async function executeCommand(interaction: Interaction): Promise<void> {
  const data = interaction.data;
  try {
    if (data?.name === "wot") {
      const sub = data.options?.find(
        (o) => o.type === ApplicationCommandOptionType.SubCommand,
      );
      if (sub?.name === "stats") {
        await executeStats(interaction, sub.options);
        return;
      }
    }
    await editInteractionResponse(interaction.token, {
      content: "Unknown command.",
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.error("discord: command execution failed", err);
    await editInteractionResponse(interaction.token, {
      content: "Something went wrong fetching those stats. Try again shortly.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
