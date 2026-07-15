import "server-only";
import { REST } from "@discordjs/rest";
import { APP_IDENTITY, env } from "@unicum.gg/shared";

// Discord OAuth2 for the "Add to Discord" install flow. A single authorization
// requests four scopes so one click does everything:
//   - `bot applications.commands` → adds the bot + its slash commands to a
//     server the user picks (they need Manage Server there). `permissions=0`:
//     the bot only sends interaction replies, so it needs nothing else.
//   - `guilds.join identify` → lets us add the *user* to *our* community server
//     via the API (`identify` to read their id, `guilds.join` to add them).
// The bot must be in our guild with CREATE_INSTANT_INVITE for the add-member
// call to succeed.
const API = "https://discord.com/api/v10";
const SCOPES = ["bot", "applications.commands", "guilds.join", "identify"];
const PERMISSIONS = "0";

/** Outcome of an install, carried back to `/bot` as `?discord=<status>`. The
 * bot install always succeeds during authorization, so the only variable is the
 * community-server join. */
export enum DiscordInstallStatus {
  /** Bot added and the user joined our community server. */
  Joined = "joined",
  /** Bot added, but the community-server join did not go through. */
  Installed = "installed",
  /** The install failed (bad state, cancelled, or misconfigured). */
  Error = "error",
}

/** Path the OAuth callback lands on. Must be registered verbatim in the Discord
 * Developer Portal (OAuth2 → Redirects). No trailing slash. */
export function discordRedirectUri(): string {
  return `${APP_IDENTITY.URL}/api/discord/callback`;
}

type DiscordConfig = {
  appId: string;
  clientSecret: string;
  botToken: string;
  guildId: string;
};

/** The install flow is available only when the whole Discord app is configured;
 * otherwise the `/bot` button hides and the routes 404. */
export function discordConfig(): DiscordConfig | null {
  const { DISCORD_APP_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } =
    env;
  if (
    !DISCORD_APP_ID ||
    !DISCORD_CLIENT_SECRET ||
    !DISCORD_BOT_TOKEN ||
    !DISCORD_GUILD_ID
  ) {
    return null;
  }
  return {
    appId: DISCORD_APP_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    botToken: DISCORD_BOT_TOKEN,
    guildId: DISCORD_GUILD_ID,
  };
}

export function isDiscordInstallEnabled(): boolean {
  return discordConfig() !== null;
}

/** The Discord authorization URL to send the user to. */
export function discordAuthorizeUrl(appId: string, state: string): string {
  const url = new URL(`${API}/oauth2/authorize`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", discordRedirectUri());
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("permissions", PERMISSIONS);
  url.searchParams.set("state", state);
  // Always show the consent screen so a re-install still works predictably.
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

/** Exchange the callback `code` for the user's access token. */
async function exchangeCode(
  config: DiscordConfig,
  code: string,
): Promise<string | null> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri(),
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
  } | null;
  return json?.access_token ?? null;
}

/** The authenticated user's id, via the `identify` scope. */
async function fetchUserId(accessToken: string): Promise<string | null> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { id?: string } | null;
  return json?.id ?? null;
}

/** A bot-token REST client for the two bot-authenticated routes below (add
 * guild member, send DM). The OAuth calls above use plain `fetch` instead. */
function botRest(config: DiscordConfig): REST {
  return new REST({ version: "10" }).setToken(config.botToken);
}

/**
 * Add the user to our guild with their `guilds.join`-scoped token.
 * `PUT /guilds/{guild}/members/{user}` resolves on 201 (added) or 204 (already
 * a member); a missing-permission / bad-token error rejects, which the caller
 * treats as "not joined".
 */
async function addUserToGuild(
  config: DiscordConfig,
  userId: string,
  accessToken: string,
): Promise<boolean> {
  try {
    await botRest(config).put(`/guilds/${config.guildId}/members/${userId}`, {
      body: { access_token: accessToken },
    });
    return true;
  } catch {
    return false;
  }
}

/** The onboarding DM: a thank-you + the command list + a link button. Built as
 * raw Discord API JSON (the web app has `@discordjs/rest`, not discord.js's
 * `EmbedBuilder`). Orange to match the site. */
function onboardingMessage() {
  return {
    embeds: [
      {
        title: `Thanks for adding ${APP_IDENTITY.NAME}!`,
        description:
          "World of Tanks stats, right in Discord. Try these in your server:",
        url: APP_IDENTITY.URL,
        color: 0xf25322,
        fields: [
          {
            name: "/player <nickname>",
            value: "Winrate, average damage and WN7/WN8/WNX for any player.",
          },
          {
            name: "/clan <tag>",
            value: "Battle-weighted member ratings, Stronghold and Clan Wars.",
          },
          {
            name: "/tank <name>",
            value: "Server-average performance and Marks of Excellence.",
          },
        ],
        footer: { text: APP_IDENTITY.NAME },
      },
    ],
    components: [
      {
        type: 1, // action row
        components: [
          {
            type: 2, // button
            style: 5, // link
            label: `Open ${APP_IDENTITY.NAME}`,
            url: APP_IDENTITY.URL,
          },
        ],
      },
    ],
  };
}

/** DM the freshly-installed user a thank-you + the commands. Best-effort: opens
 * a DM channel then posts. Fails (403) when the user has DMs from server members
 * closed, which we ignore. The bot can DM them because they now share a guild
 * (at least the server they just added it to). */
async function sendOnboardingDM(
  config: DiscordConfig,
  userId: string,
): Promise<void> {
  const rest = botRest(config);
  try {
    const dm = (await rest.post("/users/@me/channels", {
      body: { recipient_id: userId },
    })) as { id: string };
    await rest.post(`/channels/${dm.id}/messages`, {
      body: onboardingMessage(),
    });
  } catch {
    // DMs closed or no mutual guild — nothing to do.
  }
}

/**
 * Complete the callback: exchange the code, then join the user to our server.
 * The bot install (the `bot`/`applications.commands` half) already happened
 * during the authorization itself; this finishes the `guilds.join` half.
 * Returns whether the community-join succeeded (the install stands regardless).
 */
export async function completeDiscordInstall(
  config: DiscordConfig,
  code: string,
): Promise<{ joined: boolean }> {
  const accessToken = await exchangeCode(config, code);
  if (!accessToken) return { joined: false };
  const userId = await fetchUserId(accessToken);
  if (!userId) return { joined: false };
  const joined = await addUserToGuild(config, userId, accessToken).catch(
    () => false,
  );
  // Thank-you + command list, best-effort. Awaited so it completes before the
  // route returns (a serverless function may be frozen after the redirect).
  await sendOnboardingDM(config, userId);
  return { joined };
}
