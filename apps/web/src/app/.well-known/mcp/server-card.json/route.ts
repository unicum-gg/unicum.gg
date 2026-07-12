import APP from "@/constants/app";
import { MCP_NAME } from "@/services/mcp/skill";

export function GET(): Response {
  const card = {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: `${APP.NAME}/${MCP_NAME}`,
    version: APP.VERSION,
    title: APP.NAME,
    description:
      "World of Tanks stats for players, clans and tanks across EU, NA, and Asia.",
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
