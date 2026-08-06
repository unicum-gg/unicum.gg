import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import * as z from "zod";
import { APP_IDENTITY } from "@unicum.gg/shared";
import type { Commit } from "./commits";

/**
 * Turns raw commit subjects into the lines a player reads on Discord.
 *
 * A commit log is written for us, not for them ("key the isr cache namespace on
 * the build's own assets"), and no amount of parsing makes that sentence mean
 * something to someone who plays World of Tanks. So the model does the one job
 * a mapping table can't: decide what was actually visible, say it in their
 * words, and drop the rest. It never invents the shape of the message, only its
 * sentences: the schema below is the contract, `message.ts` does the rendering.
 */

// Sol, the flagship. The run is one short call a day, so the cost of the best
// model is noise, and this text is public. `gpt-5.6-terra`/`-luna` are the
// cheaper siblings if that ever stops being true.
const MODEL = "gpt-5.6";

const draftSchema = z.object({
  added: z
    .array(z.string())
    .describe("New things a visitor can now see or do."),
  changed: z
    .array(z.string())
    .describe("Fixes and improvements to things that already existed."),
  removed: z.array(z.string()).describe("Things that are gone."),
});

export type ChangelogDraft = z.infer<typeof draftSchema>;

const INSTRUCTIONS = `You write the public changelog for ${APP_IDENTITY.NAME}, a free World of Tanks stats site (player, clan and tank statistics, ratings like WN8, leaderboards, a public API and a Discord bot). It is posted in the community's Discord.

You are given the commit subjects that landed since the last changelog. Turn them into entries a player understands.

Rules:
- Write for players, not developers. Never mention code, files, components, caches, endpoints, migrations, refactors, dependencies or infrastructure.
- Drop anything a visitor cannot see. Internal work is most of the log and belongs in none of the lists.
- One entry per user-visible change. Merge the commits that make up a single change into one entry, and split a commit that shipped two unrelated things.
- Start every entry with a past-tense verb: "Added ...", "Fixed ...", "Improved ...", "Removed ...".
- Keep an entry to one line, no final period.
- Name pages by their path in backticks (\`/eu/tanks\`, \`/docs\`) when the change is about a specific page.
- Never invent a change that is not in the commits, and never pad the lists to make the update look bigger.
- Plain English. No marketing tone, no emoji, no exclamation marks.
- If nothing in the batch is user-visible, return three empty lists.`;

/** The subjects, one per line: everything the model needs, nothing else. */
function promptFrom(commits: Commit[]): string {
  const lines = commits.map((c) => `- ${c.subject}`).join("\n");
  return `${commits.length} commits landed since the last changelog, oldest first:\n\n${lines}`;
}

export function changelogWriterEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Null when the model could not be reached, which the caller treats as "try
 * again next tick" rather than "nothing to say" (an empty draft is the latter,
 * and it must not consume the batch). */
export async function writeChangelog(
  commits: Commit[],
  // Overridable so a dry run can put a candidate model side by side with the
  // one in production before the constant above is touched.
  model: string = MODEL,
): Promise<ChangelogDraft | null> {
  try {
    const { output } = await generateText({
      model: openai(model),
      instructions: INSTRUCTIONS,
      prompt: promptFrom(commits),
      output: Output.object({ schema: draftSchema }),
    });
    return output;
  } catch (err) {
    console.error("[changelog] the writer failed:", err);
    return null;
  }
}

export function isEmptyDraft(draft: ChangelogDraft): boolean {
  return (
    draft.added.length + draft.changed.length + draft.removed.length === 0
  );
}
