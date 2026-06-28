import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import * as z from "zod";
import APP from "@/constants/app";
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
    { name: "unicum.gg/stats", version: APP.VERSION },
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

export { handleMcp as GET, handleMcp as POST, handleMcp as DELETE };
