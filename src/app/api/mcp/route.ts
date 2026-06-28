import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import * as z from "zod";
import APP from "@/constants/app";
import spec from "@/services/openapi/openapi.generated.json";

type ParamSchema = { enum?: string[] };
type Param = { name: string; required?: boolean; description?: string; schema?: ParamSchema };
type Operation = {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: Param[];
};

function deriveToolName(operationId: string): string {
  return operationId
    .replace(/^get-/, "")
    .replace(/-\{[^}]+\}/g, "")
    .replace(/\{[^}]+\}-/g, "")
    .replace(/-+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildInputSchema(params: Param[]): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    let field: z.ZodTypeAny = p.schema?.enum?.length
      ? z.enum(p.schema.enum as [string, ...string[]])
      : z.string();
    if (p.description) field = field.describe(p.description);
    if (!p.required) field = field.optional();
    shape[p.name] = field;
  }
  return shape;
}

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  path: string;
};

// Build tool definitions once at module load. Skip SSE streams (/live paths).
const TOOL_DEFS: ToolDef[] = Object.entries(
  (spec as { paths?: Record<string, { get?: Operation }> }).paths ?? {},
)
  .filter(([path, item]) => !path.endsWith("/live") && !!item.get?.operationId)
  .map(([path, item]) => {
    const op = item.get!;
    return {
      name: deriveToolName(op.operationId),
      description: op.summary ?? op.description ?? `GET /api${path}`,
      inputSchema: buildInputSchema(op.parameters ?? []),
      path,
    };
  });

function createServer(): McpServer {
  const server = new McpServer(
    { name: "unicum.gg/stats", version: APP.VERSION },
    { capabilities: { tools: {} } },
  );

  const port = process.env.PORT ?? 3000;
  const apiBase = `http://localhost:${port}/api`;

  for (const { name, description, inputSchema, path: apiPath } of TOOL_DEFS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.registerTool(name, { description, inputSchema: inputSchema as any }, async (args: Record<string, string | undefined>) => {
      const typedArgs = args as Record<string, string | undefined>;
      let url = apiBase + apiPath;
      const query: Record<string, string> = {};

      for (const [key, val] of Object.entries(typedArgs)) {
        if (val === undefined) continue;
        if (url.includes(`{${key}}`)) {
          url = url.replace(`{${key}}`, encodeURIComponent(val));
        } else {
          query[key] = val;
        }
      }

      const endpoint = new URL(url);
      for (const [k, v] of Object.entries(query)) endpoint.searchParams.set(k, v);

      const res = await fetch(endpoint, { cache: "no-store" });
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
