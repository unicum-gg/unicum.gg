import { isRegion, type Region } from "@unicum.gg/wargaming";
import { APP_IDENTITY } from "../app-identity";
import { BRAND_COLOR_INT } from "../constants";

/**
 * The direct messages the bot sends members of our own server, as raw Discord
 * API JSON so the bot (discord.js) and the worker (plain REST) send the same
 * payload.
 *
 * Three of them. A newcomer is welcomed when they join, in one of two shapes:
 * one who came from Discord is shown how to link their account, which is the
 * only way they would learn it exists, and one who arrived through the link on
 * the site already wears their Wargaming name and is not asked again. The third
 * went once, by hand, to the members already there when all of this shipped,
 * and says that it is a one-off, since a server that DMs on every release is a
 * server people mute.
 */

export enum WelcomeKind {
  /** Joined from Discord, no unicum.gg account linked. */
  Newcomer = "newcomer",
  /** Joined through the link on the site: named and roled already. */
  Linked = "linked",
  /** Already a member when this shipped: the one-off "what's new". */
  Existing = "existing",
}

export type WelcomeServer = {
  guildId: string;
  tankChangesChannelId?: string;
  mapChangesChannelId?: string;
  changelogChannelId?: string;
};

export type WelcomeMember = {
  /** What they are called on Discord, for the greeting. */
  name: string;
  /** Their linked Wargaming account, when there is one. */
  account: { nickname: string; region: Region } | null;
};

type Field = { name: string; value: string };
type LinkButton = { type: 2; style: 5; label: string; url: string };

export type WelcomeMessage = {
  embeds: {
    title: string;
    description: string;
    color: number;
    fields: Field[];
    footer: { text: string };
  }[];
  components: { type: 1; components: LinkButton[] }[];
};

const site = (path: string) => `${APP_IDENTITY.URL}${path}`;
const button = (label: string, url: string): LinkButton => ({
  type: 2,
  style: 5,
  label,
  url,
});

/** A channel of the server as a link: a `<#id>` mention does not always
 * resolve in a DM, where the client has no server to read it against. */
function channel(server: WelcomeServer, id: string | undefined, name: string): string {
  return id ? `[#${name}](https://discord.com/channels/${server.guildId}/${id})` : `#${name}`;
}

/** The server's Channels & Roles page, where the onboarding answers live. */
const customize = (server: WelcomeServer) =>
  `[Channels & Roles](https://discord.com/channels/${server.guildId}/customize-community)`;

const tag = (account: NonNullable<WelcomeMember["account"]>) =>
  `${account.nickname} [${account.region.toUpperCase()}]`;

const BOT_FIELD: Field = {
  name: "🤖 Try the bot",
  value:
    "`/player` and `/clan` work in any channel of the server, and you can add the bot to your own.",
};

function linkField(member: WelcomeMember): Field {
  return member.account
    ? {
        name: "🔗 Your Wargaming name on the server",
        value: `You are **${tag(member.account)}** on the server, with the ${member.account.region.toUpperCase()} role.`,
      }
    : {
        name: "🔗 Link your Wargaming account",
        value: `Log in on unicum.gg and link Discord: your name here becomes your verified in-game name, like \`${member.name} [EU]\`, with your server role set for you.`,
      };
}

function buttons(member: WelcomeMember, withSite: boolean): WelcomeMessage["components"] {
  const first = member.account
    ? button(
        "Your profile",
        site(`/${member.account.region}/players/${encodeURIComponent(member.account.nickname)}`),
      )
    : button("Link my account", site("/api/link/discord?return=%2F"));
  return [
    {
      type: 1,
      components: [
        first,
        ...(withSite ? [button("Open unicum.gg", site("/"))] : []),
        button("Get the mod", site("/mod")),
        button("Add the bot", site("/bot")),
      ],
    },
  ];
}

export function welcomeMessage(
  kind: WelcomeKind,
  member: WelcomeMember,
  server: WelcomeServer,
): WelcomeMessage {
  const embed = (
    title: string,
    description: string,
    fields: Field[],
    footer: string,
  ) => ({ title, description, color: BRAND_COLOR_INT, fields, footer: { text: footer } });

  if (kind === WelcomeKind.Existing) {
    return {
      embeds: [
        embed(
          "What's new on the unicum.gg server 🆕",
          `Thanks for being here early, ${member.name}. We reworked the server this week, here is what changed for you:`,
          [
            {
              name: "📰 Patch notes, the day a patch lands",
              value: `${channel(server, server.tankChangesChannelId, "tank-changes")} posts every buff and nerf of each update, and ${channel(server, server.mapChangesChannelId, "map-changes")} every map rework, on their own. Follow them from your own server too.`,
            },
            {
              name: "🔔 Pick your server and your pings",
              value: `Tell us if you play on EU, Americas or Asia, and choose what to be pinged about in ${customize(server)}. Nobody gets pinged for something they did not pick.`,
            },
            linkField(member),
            {
              name: "🧩 The mod, without the wait",
              value: `Each release is on [unicum.gg/mod](${site("/mod")}) the moment it is out, before WGMods has reviewed it.`,
            },
          ],
          "This is a one-off: we won't DM you about future updates. They go in #web-changelogs, pinged only if you picked it.",
        ),
      ],
      components: buttons(member, true),
    };
  }

  const linked = kind === WelcomeKind.Linked && member.account;
  return {
    embeds: [
      embed(
        `Welcome to unicum.gg, ${member.name}! 👋`,
        linked
          ? `Your account is linked: you are **${tag(member.account!)}** on the server, with the ${member.account!.region.toUpperCase()} role. Two more things:`
          : "World of Tanks stats for 3M players, an in-game mod, and a bot you can use right here. Three things worth a minute:",
        linked
          ? [
              {
                name: "🔔 Pick your pings",
                value: `Choose what to be pinged about (tank changes, map changes, site and mod updates) in ${customize(server)}.`,
              },
              BOT_FIELD,
            ]
          : [
              {
                name: "🌍 Pick your server and your pings",
                value: `Tell us if you play on EU, Americas or Asia, and choose what to be pinged about (tank changes, map changes, site and mod updates) in ${customize(server)}.`,
              },
              linkField(member),
              BOT_FIELD,
            ],
        "Questions? Ask in #general.",
      ),
    ],
    components: buttons(member, !linked),
  };
}

/**
 * The linked account a server nickname names, read back from the shape
 * `@unicum.gg/core/discord/member-identity` writes (`Nickname [EU]`). Members
 * cannot rename themselves on our server, so that shape is only ever ours.
 */
export function memberAccountFromNickname(
  nick: string | null | undefined,
): WelcomeMember["account"] {
  const match = nick?.match(/^(.+) \[([A-Z]+)\]$/);
  const region = match?.[2]?.toLowerCase();
  if (!match || !region || !isRegion(region)) return null;
  return { nickname: match[1]!, region };
}
