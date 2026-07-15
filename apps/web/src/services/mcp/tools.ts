import spec from "@/services/openapi/openapi.generated.json";

type OpenApiSchema = Record<string, unknown> & {
  allOf?: OpenApiSchema[];
  enum?: unknown[];
  description?: string;
};
type OpenApiParam = {
  name: string;
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
};
type OpenApiOperation = {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParam[];
};
type OpenApiSpec = { paths?: Record<string, { get?: OpenApiOperation }> };

function deriveToolName(operationId: string): string {
  return operationId
    .replace(/^get-/, "")
    // `{region}` is on every route: drop it as noise. Other path params are
    // kept as `by-<name>` so distinct routes never collapse to the same tool
    // name (e.g. `/tanks` vs `/tanks/{slug}` must stay distinct, or the MCP
    // server throws "already registered" on the second registerTool).
    .replace(/\{region\}-?/g, "")
    .replace(/\{([^}]+)\}/g, "by-$1")
    .replace(/-+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function flattenAllOf(schema: OpenApiSchema): OpenApiSchema {
  if (Array.isArray(schema.allOf) && schema.allOf.length === 1) {
    const { allOf: _, ...rest } = schema;
    return { ...schema.allOf[0], ...rest };
  }
  return schema;
}

function buildJsonSchema(params: OpenApiParam[]): ToolInputSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    const s = p.schema ? flattenAllOf(p.schema) : {};
    properties[p.name] = { ...s, ...(p.description ? { description: p.description } : {}) };
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

export type ToolInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  path: string;
};

// Derived once at module load from the generated OpenAPI spec.
// SSE endpoints (/sse) are excluded: they stream, not respond.
export const TOOL_DEFS: ToolDef[] = Object.entries(
  (spec as OpenApiSpec).paths ?? {},
)
  .filter(([path, item]) => !path.endsWith("/sse") && !!item.get?.operationId)
  .map(([path, item]) => {
    const op = item.get!;
    return {
      name: deriveToolName(op.operationId),
      description: op.summary ?? op.description ?? `GET /api${path}`,
      inputSchema: buildJsonSchema(op.parameters ?? []),
      path,
    };
  });

// Fail loud at module load if two operations derive the same tool name: the MCP
// server registers tools by name and throws on a duplicate, which would 500
// every request. This turns a future collision into a build/dev-time error
// instead of a silent production outage.
const seenToolNames = new Set<string>();
for (const { name, path } of TOOL_DEFS) {
  if (seenToolNames.has(name)) {
    throw new Error(
      `Duplicate MCP tool name "${name}" (from ${path}). deriveToolName must map each API route to a unique name.`,
    );
  }
  seenToolNames.add(name);
}

/**
 * Builds the path + query string for an API call given a URL template and
 * agent-supplied arguments. Path parameters (`{key}`) are substituted inline;
 * remaining keys become query params.
 */
export function buildApiPath(template: string, args: Record<string, unknown>): string {
  let path = template;
  const query: Record<string, string> = {};
  for (const [key, val] of Object.entries(args)) {
    if (val == null) continue;
    if (path.includes(`{${key}}`)) {
      path = path.replace(`{${key}}`, encodeURIComponent(String(val)));
    } else {
      query[key] = String(val);
    }
  }
  const qs = new URLSearchParams(query).toString();
  return qs ? `${path}?${qs}` : path;
}
