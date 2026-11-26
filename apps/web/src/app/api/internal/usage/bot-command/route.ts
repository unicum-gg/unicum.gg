import { incrementUsage } from "@unicum.gg/core/usage/record";
import { env, UsageMetric } from "@unicum.gg/shared";

export const dynamic = "force-dynamic";

/** A Discord command name: lowercase, at most 32 characters. Checked so a
 * caller holding the secret still cannot write arbitrary keys into the table. */
const COMMAND_NAME = /^[a-z0-9_-]{1,32}$/;

/**
 * Count one slash command the bot answered.
 *
 * The bot never touches the database, which is a rule rather than an accident,
 * so it reports here and the API owns the write, the same split as the
 * moderation presses. Not `@openapi`-tagged, so it stays out of the public
 * document and the SDK. Authorised by `CRON_SECRET`, like the routes beside it.
 */
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    command?: unknown;
  } | null;
  const command = body?.command;
  if (typeof command !== "string" || !COMMAND_NAME.test(command)) {
    return Response.json({ error: "invalid_command" }, { status: 400 });
  }
  await incrementUsage(UsageMetric.BotCommands, command);
  return new Response(null, { status: 204 });
}
