import APP from "@/constants/app";

export function GET(): Response {
  const card = {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "unicum.gg/stats",
    version: APP.VERSION,
    title: "unicum.gg",
    description:
      "World of Tanks stats for players and clans across EU, NA, and Asia.",
    websiteUrl: APP.URL,
    repository: {
      source: "github",
      url: APP.EXTERNAL.GITHUB,
    },
    remotes: [
      {
        type: "streamable-http" as const,
        url: `${APP.URL}/api/mcp`,
      },
    ],
  };

  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
