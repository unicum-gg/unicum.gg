// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

/**
 * A JSON-RPC 2.0 response envelope from the MCP endpoint. `.loose()` because the
 * body carries either a `result` (shape depends on the method: `initialize`,
 * `tools/list`, `tools/call`, ...) or a JSON-RPC `error`; over Streamable HTTP
 * the server may instead reply with an SSE stream.
 */
export const McpResponse = z
  .object({
    jsonrpc: z.string(),
    id: z.union([z.string(), z.number()]).nullable(),
  })
  .loose()
  .meta({
    id: "McpResponse",
    description:
      "A JSON-RPC 2.0 response from the MCP endpoint (carries a method-specific `result` or a JSON-RPC `error`).",
  });
