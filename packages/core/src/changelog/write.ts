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
 * words, sort it by what matters, and drop the rest. It never invents the shape of the message, only its
 * sentences: the schema below is the contract, `message.ts` does the rendering.
 */

// Sol, the flagship. The run is one call a week, over a week of commit subjects,
// so the cost of the best model is noise, and this text is public.
// `gpt-5.6-terra`/`-luna` are the cheaper siblings if that ever stops being
// true.
const MODEL = "gpt-5.6";

/** A run holds the publish lock in `./cron` for as long as this call lasts, and
 * the catch-up that covers a missed slot is skipped while it does, so this must
 * not be able to hang on a half-open connection. Two minutes is far past what a
 * week of commit subjects takes. */
const TIMEOUT_MS = 120_000;

const entries = (what: string) =>
  z
    .array(z.string())
    .describe(`${what} Most significant first: the card shows the top few.`);

const draftSchema = z.object({
  headline: z
    .string()
    .describe(
      "One plain sentence naming the week's most significant user-visible change. Empty when every list is empty.",
    ),
  added: entries("New things a visitor can now see or do."),
  improved: entries("Things that already existed and now work better."),
  fixed: entries("Things that were broken and now work."),
  removed: entries("Things that are gone."),
});
export type ChangelogDraft = z.infer<typeof draftSchema>;

const INSTRUCTIONS = `You write the public changelog for ${APP_IDENTITY.NAME}, a free World of Tanks stats site (player, clan and tank statistics, ratings like WN8, leaderboards, a public API and a Discord bot). It is posted in the community's Discord.

You are given the commit subjects that landed since the last changelog. Turn them into entries a player understands.

Rules:
- Write for players, not developers. Never mention code, files, components, caches, endpoints, migrations, refactors, dependencies or infrastructure.
- Drop anything a visitor cannot see. Internal work is most of the log and belongs in none of the lists.
- One entry per user-visible change. Merge the commits that make up a single change into one entry, and split a commit that shipped two unrelated things.
- Put each entry in exactly one list: added (new), improved (better), fixed (was broken), removed (gone).
- Do not start an entry with the list's own verb ("Added", "Fixed", "Improved", "Removed"): each list is shown under its own heading, so write the thing itself. A new entry names what arrived ("A replay catalogue and battle pages"), an improvement says what got better ("Faster player pages and leaderboards"), a fix names what was wrong ("Projected Maneuvers cutoffs being too low during rising races").
- Order every list by how much it matters to a player, most significant first. Only the first few of each list are shown on the card, the rest in a thread under it.
- Keep an entry to one line, no final period.
- The headline is one sentence about the single change a player would most want to hear about this week, in the same plain voice. Not a summary of the lists.
- Name pages by their path in backticks (\`/eu/tanks\`, \`/docs\`) when the change is about a specific page.
- Never invent a change that is not in the commits, and never pad the lists to make the update look bigger.
- Plain English. No marketing tone, no emoji, no exclamation marks.
- If nothing in the batch is user-visible, return four empty lists and an empty headline.`;

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
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return output;
  } catch (err) {
    console.error("[changelog] the writer failed:", err);
    return null;
  }
}

export function isEmptyDraft(draft: ChangelogDraft): boolean {
  return (
    draft.added.length +
      draft.improved.length +
      draft.fixed.length +
      draft.removed.length ===
    0
  );
}
