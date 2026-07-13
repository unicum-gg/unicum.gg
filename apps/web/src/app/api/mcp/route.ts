import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import * as z from "zod";
import APP from "@/constants/app";
import { MCP_NAME } from "@/services/mcp/skill";
import { TOOL_DEFS, buildApiPath, type ToolInputSchema } from "@/services/mcp/tools";

function toZodShape(schema: ToolInputSchema): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set<string>(schema.required ?? []);
  for (const [name, s] of Object.entries(schema.properties)) {
    const prop = s as { enum?: string[]; description?: string };
    let field: z.ZodTypeAny = prop.enum?.length
      ? z.enum(prop.enum as [string, ...string[]])
      : z.string();
    if (prop.description) field = field.describe(prop.description);
    if (!required.has(name)) field = field.optional();
    shape[name] = field;
  }
  return shape;
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: `${APP.NAME}/${MCP_NAME}`, version: APP.VERSION },
    { capabilities: { tools: {} } },
  );

  const port = process.env.PORT ?? 3000;
  const apiBase = `http://localhost:${port}/api`;

  for (const { name, description, inputSchema, path } of TOOL_DEFS) {
    const zodShape = toZodShape(inputSchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.registerTool(name, { description, inputSchema: zodShape as any }, async (args: Record<string, unknown>) => {
      const apiPath = buildApiPath(path, args as Record<string, unknown>);
      const res = await fetch(`${apiBase}${apiPath}`, { cache: "no-store" });
      const text = await res.text();
      return { content: [{ type: "text" as const, text }] };
    });
  }

  return server;
}

async function handleMcp(request: Request): Promise<Response> {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session tracking between requests
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// GET opens the SSE stream and DELETE ends a session (both part of the
// Streamable HTTP transport); POST carries the JSON-RPC messages and is the one
// documented below.
export { handleMcp as GET, handleMcp as DELETE };

/**
 * MCP endpoint
 * @description Model Context Protocol (MCP) server over a stateless Streamable HTTP transport. Point an MCP client at this URL to use unicum.gg's read API as MCP tools (the same player, clan and tank data as the REST endpoints). The POST body is a JSON-RPC 2.0 message (`initialize`, `tools/list`, `tools/call`, ...); the server replies with a JSON-RPC response or, when streaming, an SSE stream. `GET` opens the SSE stream and `DELETE` ends a session (transport-level, not documented separately).
 * @response McpResponse
 * @tag MCP
 * @openapi
 */
export async function POST(request: Request): Promise<Response> {
  return handleMcp(request);
}
