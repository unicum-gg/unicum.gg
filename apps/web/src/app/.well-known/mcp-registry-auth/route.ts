import { MCP_REGISTRY_PUBLIC_KEY } from "@/services/mcp/registry";

export function GET(): Response {
  return new Response(`v=MCPv1; k=ed25519; p=${MCP_REGISTRY_PUBLIC_KEY}`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
