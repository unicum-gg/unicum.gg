import "server-only";
import { REST } from "@discordjs/rest";
import { OAuth2Scopes, PermissionFlagsBits } from "discord-api-types/v10";
import { APP_IDENTITY, BRAND_COLOR_INT, env } from "@unicum.gg/shared";

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
const SCOPES = [
  OAuth2Scopes.Bot,
  OAuth2Scopes.ApplicationsCommands,
  OAuth2Scopes.GuildsJoin,
  OAuth2Scopes.Identify,
];
const PERMISSIONS = "0";

// The boost-notification connect flow additionally reads the user's server list
// (`guilds`) so they can pick a destination, and adds the bot with the exact
// permissions it needs to POST there: View Channel + Send Messages + Embed Links
// (= 19456).
const SCOPES_BOOST = [...SCOPES, OAuth2Scopes.Guilds];
const PERMISSIONS_BOOST = (
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks
).toString();
/** Discord's "Manage Server" permission: who may set up notifications. */
const MANAGE_GUILD = PermissionFlagsBits.ManageGuild;

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

/** Authorization URL for the boost-notification connect flow (reads the user's
 * servers + adds the bot with post permissions). */
export function discordBoostAuthorizeUrl(appId: string, state: string): string {
  const url = new URL(`${API}/oauth2/authorize`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", discordRedirectUri());
  url.searchParams.set("scope", SCOPES_BOOST.join(" "));
  url.searchParams.set("permissions", PERMISSIONS_BOOST);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

/** Exchange the callback `code` for the user's access token. `redirectUri` must
 * match the one used to authorize (the install vs boost flow differ). */
async function exchangeCode(
  config: DiscordConfig,
  code: string,
  redirectUri: string = discordRedirectUri(),
): Promise<string | null> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
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

/** The servers the user can set notifications up in (owner or Manage Server),
 * via the `guilds` scope. */
async function fetchUserManagedGuilds(
  accessToken: string,
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as
    | { id: string; name: string; owner?: boolean; permissions?: string }[]
    | null;
  if (!json) return [];
  return json
    .filter(
      (g) =>
        g.owner || (BigInt(g.permissions ?? "0") & MANAGE_GUILD) === MANAGE_GUILD,
    )
    .map((g) => ({ id: g.id, name: g.name }));
}

/**
 * Complete the boost-connect callback: exchange the code, read the user's
 * manageable servers, and — like the install flow — join them to our community
 * server (best-effort). Returns their server list for the destination picker.
 */
export async function completeBoostConnect(
  config: DiscordConfig,
  code: string,
): Promise<{ guilds: { id: string; name: string }[] } | null> {
  const accessToken = await exchangeCode(config, code);
  if (!accessToken) return null;
  const [userId, guilds] = await Promise.all([
    fetchUserId(accessToken),
    fetchUserManagedGuilds(accessToken),
  ]);
  // Add them to our community server if they aren't already (their choice was
  // implicit in authorizing `guilds.join`).
  if (userId) await addUserToGuild(config, userId, accessToken).catch(() => {});
  return { guilds };
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
export async function addUserToGuild(
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
        color: BRAND_COLOR_INT,
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
          {
            name: "/maps <name>",
            value: "Size, battle timer, team size and game modes, with the minimap.",
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
