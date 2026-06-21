// Registers the unicum.gg `/wot` slash command tree with Discord.
// Run once after the application secrets are provisioned, and again whenever
// the command shape changes:
//
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... pnpm tsx scripts/register-discord-commands.ts
//
// PUT is idempotent: it replaces the full global command set, so re-running is
// safe. Global commands can take up to an hour to propagate to every client.

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const commands = [
  {
    name: "wot",
    description: "World of Tanks stats from unicum.gg",
    type: 1,
    options: [
      {
        type: 1,
        name: "stats",
        description: "Player stat card with a link to the full profile",
        options: [
          {
            type: 3,
            name: "player",
            description: "World of Tanks player name (exact match)",
            required: true,
          },
          {
            type: 3,
            name: "region",
            description: "Region (defaults to searching EU, NA and ASIA)",
            required: false,
            choices: [
              { name: "EU", value: "eu" },
              { name: "NA", value: "na" },
              { name: "ASIA", value: "asia" },
            ],
          },
        ],
      },
    ],
  },
];

async function main(): Promise<void> {
  if (!APP_ID || !BOT_TOKEN) {
    console.error(
      "Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN in the environment.",
    );
    process.exit(1);
  }
  const res = await fetch(
    `https://discord.com/api/v10/applications/${APP_ID}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    },
  );
  const body = await res.text();
  if (!res.ok) {
    console.error(`Failed to register commands (${res.status}): ${body}`);
    process.exit(1);
  }
  console.log("Registered global commands:", body);
}

void main();
